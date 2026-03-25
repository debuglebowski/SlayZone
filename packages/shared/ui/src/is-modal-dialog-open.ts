/** Returns true when any Radix UI modal dialog or alert dialog is open in the DOM. */
export function isModalDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}
