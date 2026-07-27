-- ============================================================================
-- 030 — Share content permissions (defense-in-depth for get_share_by_token)
--
-- Storage: permissions live in property_shares.snapshot_json (jsonb) —
--   { version: 3, permissions: { preset, sections, itemIds }, ...filtered content }
-- No new column or share-content table is required.
--
-- This migration updates get_share_by_token so the public response only returns
-- curated share fields and a snapshot that has been stripped according to the
-- embedded permissions. Revoked / expired tokens still return null.
--
-- DO NOT apply automatically — run in Supabase SQL editor after review.
-- ============================================================================

create or replace function public.get_share_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.property_shares%rowtype;
  v_snap jsonb;
  v_perm jsonb;
  v_sections jsonb;
  v_out jsonb;
  v_docs jsonb;
  v_repairs jsonb;
  v_apps jsonb;
begin
  select * into v_share
  from public.property_shares
  where share_token = trim(p_token)
    and is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  if v_share.expires_at is not null and v_share.expires_at < now() then
    return null;
  end if;

  update public.property_shares
  set views_count = coalesce(views_count, 0) + 1
  where id = v_share.id;

  v_share.views_count := coalesce(v_share.views_count, 0) + 1;

  v_snap := coalesce(v_share.snapshot_json, '{}'::jsonb);
  v_perm := v_snap->'permissions';
  v_sections := case
    when v_perm is null or jsonb_typeof(v_perm->'sections') <> 'object'
      then null
    else v_perm->'sections'
  end;

  -- Legacy snapshots without permissions: return stored snapshot as-is
  -- (already a point-in-time copy; never join live private tables).
  if v_sections is null then
    v_out := jsonb_build_object(
      'id', v_share.id,
      'property_id', v_share.property_id,
      'property_label', v_share.property_label,
      'share_token', v_share.share_token,
      'label', v_share.label,
      'expires_at', v_share.expires_at,
      'is_active', v_share.is_active,
      'views_count', v_share.views_count,
      'include_personal_info', coalesce(v_share.include_personal_info, false),
      'snapshot_json', v_snap,
      'created_at', v_share.created_at,
      'updated_at', v_share.updated_at
    );
    return v_out;
  end if;

  -- Strip sections / fields that are not permitted (defense in depth).
  if coalesce((v_sections->>'basicPropertyInfo')::boolean, false) is not true then
    v_snap := v_snap
      - 'propertyType' - 'yearBuilt' - 'squareFootage'
      - 'bedrooms' - 'bathrooms' - 'lotSize';
  end if;

  if coalesce((v_sections->>'propertyAddress')::boolean, false) is not true then
    v_snap := v_snap - 'address' - 'city' - 'state' - 'zip' - 'fullAddress';
  end if;

  if coalesce((v_sections->>'propertyPhotos')::boolean, false) is not true then
    v_snap := v_snap - 'photoUri';
    v_snap := jsonb_set(v_snap, '{gallery}', '[]'::jsonb, true);
  end if;

  if coalesce((v_sections->>'maintenanceHistory')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{maintenanceHistory}', '[]'::jsonb, true);
  end if;

  if coalesce((v_sections->>'upcomingMaintenance')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{upcomingMaintenance}', '[]'::jsonb, true);
  end if;

  if coalesce((v_sections->>'completedRepairs')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{recentRepairs}', '[]'::jsonb, true);
  end if;

  if coalesce((v_sections->>'maintenanceHistory')::boolean, false) is not true
     and coalesce((v_sections->>'completedRepairs')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{timeline}', '[]'::jsonb, true);
  end if;

  -- Repair costs / contractor contact / private notes
  v_repairs := coalesce(v_snap->'recentRepairs', '[]'::jsonb);
  if jsonb_typeof(v_repairs) = 'array' then
    select coalesce(jsonb_agg(
      (elem - 'notes')
      || case when coalesce((v_sections->>'repairCosts')::boolean, false) is true
           then '{}'::jsonb else jsonb_build_object('cost', null) end
      || case when coalesce((v_sections->>'contractorContact')::boolean, false) is true
           then '{}'::jsonb else jsonb_build_object('contractor', null) end
    ), '[]'::jsonb)
    into v_repairs
    from jsonb_array_elements(v_repairs) as elem;
    v_snap := jsonb_set(v_snap, '{recentRepairs}', v_repairs, true);
  end if;

  if coalesce((v_sections->>'appliances')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{appliances}', '[]'::jsonb, true);
  else
    v_apps := coalesce(v_snap->'appliances', '[]'::jsonb);
    if jsonb_typeof(v_apps) = 'array' then
      select coalesce(jsonb_agg(
        case when coalesce((v_sections->>'appliancePhotos')::boolean, false) is true
          then elem else (elem - 'photoUri') end
        || case when coalesce((v_sections->>'applianceModelSerial')::boolean, false) is true
          then '{}'::jsonb
          else jsonb_build_object('model', null, 'serial', null) end
      ), '[]'::jsonb)
      into v_apps
      from jsonb_array_elements(v_apps) as elem;
      v_snap := jsonb_set(v_snap, '{appliances}', v_apps, true);
    end if;
  end if;

  -- Documents by category flags
  v_docs := coalesce(v_snap->'documents', '[]'::jsonb);
  if jsonb_typeof(v_docs) = 'array' then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_docs
    from jsonb_array_elements(v_docs) as elem
    where
      case coalesce(elem->>'category', '')
        when 'receipt' then coalesce((v_sections->>'receipts')::boolean, false)
        when 'inspection' then
          coalesce((v_sections->>'inspectionReports')::boolean, false)
          or coalesce((v_sections->>'documents')::boolean, false)
        when 'permit' then
          coalesce((v_sections->>'permits')::boolean, false)
          or coalesce((v_sections->>'documents')::boolean, false)
        when 'warranty' then
          coalesce((v_sections->>'warranties')::boolean, false)
          or coalesce((v_sections->>'documents')::boolean, false)
        else coalesce((v_sections->>'documents')::boolean, false)
      end;
    v_snap := jsonb_set(v_snap, '{documents}', v_docs, true);
  end if;

  if coalesce((v_sections->>'warranties')::boolean, false) is not true then
    v_snap := jsonb_set(v_snap, '{warranties}', '[]'::jsonb, true);
  end if;

  if coalesce((v_sections->>'ownerMessage')::boolean, false) is not true then
    v_snap := v_snap - 'ownerMessage';
  end if;

  if coalesce((v_sections->>'ownerContact')::boolean, false) is not true then
    v_snap := v_snap - 'ownerContact';
  end if;

  -- Never expose private notes key leftovers
  v_snap := v_snap - 'privateNotes' - 'ownerEmail' - 'ownerPhone' - 'tenantInfo'
    - 'financialAccounts' - 'internalReminders' - 'adminInfo';

  -- Public response: curated fields only (no live join to private tables).
  v_out := jsonb_build_object(
    'id', v_share.id,
    'property_id', v_share.property_id,
    'property_label', v_share.property_label,
    'share_token', v_share.share_token,
    'label', v_share.label,
    'expires_at', v_share.expires_at,
    'is_active', v_share.is_active,
    'views_count', v_share.views_count,
    'include_personal_info',
      (coalesce(v_share.include_personal_info, false)
        and coalesce((v_sections->>'ownerContact')::boolean, false)),
    'snapshot_json', v_snap,
    'created_at', v_share.created_at,
    'updated_at', v_share.updated_at
  );

  return v_out;
end;
$$;

grant execute on function public.get_share_by_token(text) to anon, authenticated;

comment on function public.get_share_by_token(text) is
  'Public share lookup by token. Returns null if inactive/expired. Snapshot sanitized by embedded permissions.';
