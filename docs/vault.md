# The Vault

Your Vault is the heart of ThinkPod — the folder where all your notes live.

## What is a Vault?

A **Vault** is simply a folder on your computer containing:
- **Markdown files** (your notes)
- **Subfolders** (for organization)
- **Assets** (images, attachments)

That's it. No proprietary formats, no lock-in. Just files you own.

---

## Vault Structure

When you create a new Vault, ThinkPod sets up this structure:

```
MyVault/
├── Journal/          # Daily reflections, logs
├── Ideas/            # Brainstorms, concepts
├── Projects/         # Work in progress
├── People/           # Notes about individuals
├── Others/           # Everything else
├── Drafts/           # Unfinished thoughts
└── _agent_vault/     # Wilfred's personal notes (coming soon)
```

You can customize this structure however you like — add folders, rename them, reorganize freely.

---

## How Notes are Stored

### File Format

Every note is a **plain markdown file** with a `.md` extension.

Example: `My First Thought.md`

```markdown
# My First Thought

This is a note about something interesting.

- Point one
- Point two

**Bold text** and *italic text* work too.
```

### Metadata

ThinkPod stores additional metadata in a local SQLite database:
- Created/modified timestamps
- Tags
- Category
- Conversation history with Wilfred

But the **note content itself** is always in the markdown file. Even if you delete the database, your notes remain intact.

---

## Categories

ThinkPod organizes notes into categories:

### Journal
Personal reflections, daily logs, stream of consciousness. Dated entries work well here.

### Ideas
Brainstorms, concepts, "shower thoughts". Rough and unpolished is fine.

### Projects
Active work, plans, goals. Anything you're actively developing.

### People
Notes about individuals — contacts, relationships, conversations.

### Others
Miscellaneous notes that don't fit elsewhere.

### Drafts
Temporary holding area for unfinished thoughts. Move to a category when ready.

---

## Working with Files

### Creating Notes

- **In ThinkPod**: Press `Cmd+N`
- **Outside ThinkPod**: Create a `.md` file in your Vault folder

Both work! ThinkPod will detect new files automatically.

### Editing Notes

- **In ThinkPod**: Click a note to open it
- **Outside ThinkPod**: Open the `.md` file in any text editor

Changes sync automatically.

### Moving Notes

- **In ThinkPod**: Drag and drop in the sidebar
- **Outside ThinkPod**: Move the `.md` file to a different folder

ThinkPod updates its index automatically.

### Deleting Notes

- **In ThinkPod**: Right-click → Delete
- **Outside ThinkPod**: Delete the `.md` file

Deleted notes go to your OS trash/recycle bin.

---

## Assets & Attachments

### Images

Reference images in markdown:

```markdown
![Description](./images/photo.jpg)
```

Store images in an `images/` subfolder in your Vault.

### Links

Link between notes:

```markdown
See also: [My Other Note](./Ideas/My%20Other%20Note.md)
```

ThinkPod supports standard markdown links.

---

## Vault Location

### Where is my Vault?

You chose the location during setup. To find it:
1. Go to **Settings → General**
2. Look for **Vault Path**

### Can I move my Vault?

Yes! 
1. Close ThinkPod
2. Move the entire Vault folder to a new location
3. Open ThinkPod
4. Update the Vault path in Settings

### Can I have multiple Vaults?

Not currently. ThinkPod works with one Vault at a time. You can switch Vaults by changing the path in Settings.

---

## Backup & Sync

### Backup

Your Vault is just a folder. Back it up like any other folder:

- **macOS**: Time Machine
- **Windows**: File History, OneDrive
- **Linux**: rsync, Timeshift
- **Cross-platform**: Git, Dropbox, Google Drive

### Sync Across Devices

ThinkPod doesn't have built-in sync, but you can use:

- **Git**: Version control + sync
- **Dropbox/Google Drive**: Cloud sync
- **Syncthing**: Peer-to-peer sync
- **iCloud/OneDrive**: Native OS sync

Just point ThinkPod to the synced folder on each device.

### Caution: Concurrent Editing

If syncing across devices, avoid editing the same note on multiple devices simultaneously. File conflicts can occur.

---

## Vault Privacy

### What has access to my Vault?

- **ThinkPod**: Full read/write access
- **Wilfred (local AI)**: Reads notes when you ask
- **Wilfred (cloud AI)**: Only sees notes you explicitly discuss
- **Other apps**: Only if you grant them access

### Encryption

Your Vault is stored unencrypted by default. To encrypt:

- **macOS**: Use FileVault (full disk encryption)
- **Windows**: Use BitLocker
- **Linux**: Use LUKS or eCryptfs

This encrypts your entire drive, including the Vault.

---

## Advanced: Vault Customization

### Custom Folder Structure

You're not limited to the default categories. Create any structure you want:

```
MyVault/
├── Work/
│   ├── Projects/
│   └── Meetings/
├── Personal/
│   ├── Journal/
│   └── Health/
└── Learning/
    ├── Books/
    └── Courses/
```

ThinkPod adapts to your structure.

### Templates

Create note templates by saving markdown files:

```
MyVault/
└── _templates/
    ├── daily-journal.md
    ├── meeting-notes.md
    └── project-plan.md
```

Copy and customize as needed.

### Automation

Since your Vault is just files, you can automate with scripts:
- Auto-generate daily journal entries
- Batch rename files
- Extract metadata
- Generate indexes

---

## Troubleshooting

### "ThinkPod can't access my Vault"

1. Check folder permissions (must be readable/writable)
2. Verify the path is correct
3. Ensure the folder exists
4. Try choosing a different location

### "My notes aren't showing up"

1. Check they're `.md` files (not `.txt`)
2. Verify they're in the Vault folder
3. Try refreshing: close and reopen ThinkPod
4. Check the file isn't hidden (starts with `.`)

### "Changes aren't syncing"

1. If using cloud sync, check sync status
2. Ensure no file conflicts
3. Verify both devices point to the same Vault
4. Check for network issues (if cloud syncing)

---

## Next Steps

- [Writing & Editing](./writing.md) - Document management
- [Wilfred Guide](./wilfred.md) - How Wilfred uses your Vault
- [Privacy & Security](./privacy.md) - Protecting your data
