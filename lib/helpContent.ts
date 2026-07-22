export type HelpTopic = {
  id: string;
  title: string;
  body: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const HOW_TO_TOPICS: HelpTopic[] = [
  {
    id: "first-property",
    title: "Add your first property",
    body:
      "Open Properties, tap Add Property, and enter the address and basic details. Once saved, that home becomes your active property on Home and Maintenance.",
  },
  {
    id: "switch-properties",
    title: "Switch properties",
    body:
      "On Home, use the property picker at the top. On Properties, tap any home card. Rental Portfolio also opens each property when you tap its card.",
  },
  {
    id: "add-task",
    title: "Add a maintenance task",
    body:
      "Open Maintenance and tap + Add Task (or + Add on smaller screens). Enter a name, choose a calendar date or a relative time like “Due in 2 weeks,” then save.",
  },
  {
    id: "mark-complete",
    title: "Mark a task complete",
    body:
      "Open the task, tap Mark Complete, then choose Delete, Reschedule, or Archive. You can add a completion date, notes, and photos.",
  },
  {
    id: "next-due",
    title: "Schedule the next due date",
    body:
      "When you complete and schedule again, pick a preset (3 days, 1 week, 3 months, and more) or enter “Due in X days/weeks/months.” The real calendar date is shown before you save.",
  },
  {
    id: "add-appliance",
    title: "Add an appliance",
    body:
      "From Maintenance, tap + Add Appliance. Fill in the name and details, attach photos if you like, then save. Open any appliance card later to edit or delete it.",
  },
  {
    id: "log-repair",
    title: "Log a repair",
    body:
      "From Maintenance, tap + Log Repair. Add the repair name, date, cost, and optional photos. Tap a repair card anytime to view or edit it.",
  },
  {
    id: "upload-docs",
    title: "Upload documents",
    body:
      "Open your property’s Documents section (or Vault). Choose a file or photo, give it a clear title, pick a category such as warranty or receipt, then save.",
  },
  {
    id: "photos",
    title: "Add and delete photos",
    body:
      "In Property Photos, add a photo from your library or camera. Tap a thumbnail to view it. Use Delete in the viewer to remove it — the photo stays gone after refresh.",
  },
  {
    id: "share-link",
    title: "Create a property share link",
    body:
      "Open Sharing from Features (or your property tools). Create a link to share a read-only report. Anyone with an active link can view it until you turn the link off.",
  },
  {
    id: "reports",
    title: "Generate reports",
    body:
      "Open the Reports tab to build and export property summaries. Choose the property first so the report matches the home you care about.",
  },
  {
    id: "delete-property",
    title: "Delete a property",
    body:
      "Open the property record, then use Delete Property and confirm. This removes that home’s tasks, repairs, documents, and photos from your account. This cannot be undone.",
  },
  {
    id: "rental-portfolio",
    title: "Use Rental Portfolio",
    body:
      "Open Rental Portfolio from Features. Tap any property card to open its full record. Use the summary cards and quick actions to jump into tasks, documents, or reports.",
  },
  {
    id: "home-score",
    title: "Understand the Home Score",
    body:
      "Home Score summarizes how complete and up to date your property records are. Tap a score category on Home to see what improves that area — for example overdue tasks or missing documents.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "completed-move",
    question: "Why did my task move to Completed?",
    answer:
      "When you choose Archive, the task is marked Completed and leaves Upcoming and Overdue. It appears under Completed / Past Tasks. Delete removes it permanently. Reschedule keeps it active with a new due date.",
  },
  {
    id: "recurring",
    question: "How do recurring tasks work?",
    answer:
      "If you complete a task and choose Reschedule, you pick the next due timing. The same task stays on your list with a new due date instead of sitting in Completed.",
  },
  {
    id: "change-due",
    question: "Can I change a due date?",
    answer:
      "Yes. Open the task, tap Edit, then choose a new calendar date or a relative time like “Due in 1 month.” The calculated date is shown before you save.",
  },
  {
    id: "delete-photo",
    question: "How do I delete a photo?",
    answer:
      "Open the photo from Property Photos, then tap Delete and confirm. The image is removed from your property and should not come back after refresh.",
  },
  {
    id: "documents-where",
    question: "Where are my uploaded documents?",
    answer:
      "They live under your property’s Documents section and in Vault. Open Documents to browse by property, or Vault for a broader file view.",
  },
  {
    id: "share-how",
    question: "How do I share a property?",
    answer:
      "Use Sharing to create a link. Anyone with an active link can view a read-only report. You can copy the link or open it yourself, and turn sharing off later.",
  },
  {
    id: "multi-property",
    question: "Can I manage multiple properties?",
    answer:
      "Yes. Add each home under Properties, then switch with the Home property picker or by tapping a card. Rental Portfolio helps when you manage several rentals.",
  },
  {
    id: "delete-property-faq",
    question: "What happens when I delete a property?",
    answer:
      "That property and its related tasks, repairs, appliances, documents, and photos are removed from your account. Confirm carefully — deletion cannot be undone.",
  },
  {
    id: "premium",
    question: "Why is a feature marked Premium?",
    answer:
      "Some tools are included with a paid plan. You can still browse Property Journal; Premium labels show which extras need an upgrade. Open Subscriptions for plan details.",
  },
  {
    id: "support",
    question: "How do I contact support?",
    answer:
      "Open Profile → Submit Support Ticket, or email support@homewise.app. We typically respond within 24 hours.",
  },
];
