# Save RSVPs to a Google Sheet

Every reply from the form becomes one row in a Google Sheet that both of you can open.

It has to be a **Google Sheet**, not an Excel file: the website has no login, so it needs a
small script attached to the sheet to accept the rows. A plain sharing link is not enough —
the link the site needs is the script's **web-app URL** from step 3.

## 1. Create the sheet
1. Open https://sheets.new while signed in to Google.
2. Name it, for example **Wedding RSVPs**.
3. Click **Share** and add the other person as an editor, so you can both see replies.

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in `Code.gs` and paste this:

```js
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // two replies arriving together can't overwrite each other
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Received", "Name", "Phone", "Coming", "Guests", "Arriving", "Ceremonies", "Invited as"]);
      sheet.setFrozenRows(1);
    }
    const r = JSON.parse(e.postData.contents);
    // Text that starts like a formula is stored as plain text, never run.
    const safe = (v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);
    const row = [new Date(), r.name, r.phone, r.coming, r.guests, r.arriving, r.ceremonies, r.invitedAs].map(safe);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}
```

3. Click **Save**.

## 3. Publish it as a web app
1. **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Set **Execute as:** Me, and **Who has access:** Anyone.
   ("Anyone" lets guests' phones add rows. Nobody can read the sheet through it.)
4. **Deploy → Authorize access**. Google warns that the app isn't verified because it is your
   own script: **Advanced → Go to (project name) → Allow**.
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.

## 4. Put the URL in the site
Paste it into `content/wedding.ts`:

```ts
rsvpSheetUrl: "https://script.google.com/macros/s/AKfy.../exec",
```

Then publish the site again. From then on the form saves to the sheet instead of opening WhatsApp.

## Good to know
- The web-app URL is visible in the site's code, so someone who goes looking could add junk
  rows. They can never read the sheet.
- A guest who changes their mind and sends again adds a second row; the latest row is their answer.
- If you edit the script later, use **Deploy → Manage deployments → Edit → Version: New version**
  so the same URL keeps working.
- Times in "Received" use the sheet's time zone (File → Settings).
