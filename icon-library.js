/**
 * Centralised SVG Icon Library
 * Provides consistent cross-platform icon rendering using SVG
 * All icons use currentColor for stroke/fill to inherit text colour
 *
 * Usage in HTML:
 *   <span aria-hidden="true" data-icon="check"></span> Label Text
 *
 * Usage in JavaScript:
 *   element.innerHTML = getIcon('check') + ' Label Text';
 *   // Or with custom class:
 *   element.innerHTML = getIcon('check', { className: 'large-icon' });
 *
 * Icons are automatically populated on DOMContentLoaded for any element
 * with a data-icon attribute.
 *
 * @version 1.0.0
 * @author Matthew Deeprose
 */

(function () {
  "use strict";

  /**
   * SVG icons registry
   * All icons are 21x21 viewBox for consistent sizing
   * All use currentColor for theming support
   * @constant {Object.<string, string>}
   */
  const ICONS = {
    // ═══════════════════════════════════════════════════════════════════════
    // UI Actions
    // ═══════════════════════════════════════════════════════════════════════

    // Close (✕)
    close:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 5)"><path d="m10.5 10.5-10-10z"/><path d="m10.5.5-10 10"/></g></svg>',

    // Check (✓/✔)
    check:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>',

    // Check Circle (✅)
    checkCircle:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m5.5 9.5 2 2 5-5"/></g></svg>',

    // Error (❌/✗)
    error:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 5)"><path d="m10.5 10.5-10-10z"/><path d="m10.5.5-10 10"/></g></svg>',

    // Warning (⚠️)
    warning:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>',

    // Download (⬇️)
    download:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m11.5 8.5-3.978 4-4.022-4"/><path d="m7.522.521v11.979"/><path d="m.5 9v4.5c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-4.5"/></g></svg>',

    // Upload (📤)
    upload:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m11.5 4.5-3.978-4-4.022 4"/><path d="m7.522.521v11.979"/><path d="m.5 9v4.5c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-4.5"/></g></svg>',

    // Refresh/Rotate (🔄)
    refresh:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 1)"><path d="m1.5 5.5c1.37786776-2.41169541 4.02354835-4 7-4 4.418278 0 8 3.581722 8 8m-1 4c-1.4081018 2.2866288-4.1175492 4-7 4-4.418278 0-8-3.581722-8-8"/><path d="m6.5 5.5h-5v-5"/><path d="m10.5 13.5h5v5"/></g></svg>',

    // Undo (↩️/↶)
    undo: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 7)"><path d="m.5 6.5c3.33333333-4 6.33333333-6 9-6 2.6666667 0 5 1 7 3"/><path d="m.5 1.5v5h5"/></g></svg>',

    // Redo (↪️/↷)
    redo: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 7)"><path d="m16.5 6.5c-3.1700033-4-6.1700033-6-9-6-2.82999674 0-5.16333008 1-7 3"/><path d="m11.5 6.5h5v-5"/></g></svg>',

    // Clear/Trash (🗑️)
    trash:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 2)"><path d="m2.5 2.5h10v12c0 1.1045695-.8954305 2-2 2h-6c-1.1045695 0-2-.8954305-2-2zm5-2c1.0543618 0 1.91816512.81587779 1.99451426 1.85073766l.00548574.14926234h-4c0-1.1045695.8954305-2 2-2z"/><path d="m.5 2.5h14"/><path d="m5.5 5.5v8"/><path d="m9.5 5.5v8"/></g></svg>',

    // Search/Magnify (🔍)
    search:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8.5" r="5"/><path d="m17.571 17.5-5.571-5.5"/></g></svg>',

    // Gear/Settings (⚙️)
    gear: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m7.5.5c.35132769 0 .69661025.02588228 1.03404495.07584411l.50785434 1.53911115c.44544792.12730646.86820077.30839026 1.26078721.53578009l1.4600028-.70360861c.5166435.39719686.9762801.86487779 1.3645249 1.388658l-.7293289 1.44720284c.2201691.39604534.3936959.82158734.5131582 1.2692035l1.5298263.5338186c.0390082.29913986.0591302.60421522.0591302.91399032 0 .35132769-.0258823.69661025-.0758441 1.03404495l-1.5391112.50785434c-.1273064.44544792-.3083902.86820077-.5357801 1.26078721l.7036087 1.4600028c-.3971969.5166435-.8648778.9762801-1.388658 1.3645249l-1.4472029-.7293289c-.39604532.2201691-.82158732.3936959-1.26920348.5131582l-.5338186 1.5298263c-.29913986.0390082-.60421522.0591302-.91399032.0591302-.35132769 0-.69661025-.0258823-1.03404495-.0758441l-.50785434-1.5391112c-.44544792-.1273064-.86820077-.3083902-1.26078723-.5357801l-1.46000277.7036087c-.51664349-.3971969-.97628006-.8648778-1.36452491-1.388658l.72932886-1.4472029c-.2203328-.39633993-.39395403-.82222042-.51342462-1.27020241l-1.52968981-.53381682c-.03892294-.29882066-.05900023-.60356226-.05900023-.91299317 0-.35132769.02588228-.69661025.07584411-1.03404495l1.53911115-.50785434c.12730646-.44544792.30839026-.86820077.53578009-1.26078723l-.70360861-1.46000277c.39719686-.51664349.86487779-.97628006 1.388658-1.36452491l1.44720284.72932886c.39633995-.2203328.82222044-.39395403 1.27020243-.51342462l.53381682-1.52968981c.29882066-.03892294.60356226-.05900023.91299317-.05900023z" stroke-width=".933"/><circle cx="7.5" cy="7.5" r="3"/></g></svg>',

    // Return Arrow (↩️ - for restore actions)
    returnArrow:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 6)"><path d="m1.378 1.376 4.243.003v4.242" transform="matrix(-.70710678 .70710678 .70710678 .70710678 3.500179 -1.449821)"/><path d="m5.5 9.49998326h5c2 .00089417 3-.99910025 3-2.99998326s-1-3.00088859-3-3.00001674h-10"/></g></svg>',
    // Plus
    plus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',

    // Settings (alias for gear - ⚙️)
    settings:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m7.5.5c.35132769 0 .69661025.02588228 1.03404495.07584411l.50785434 1.53911115c.44544792.12730646.86820077.30839026 1.26078721.53578009l1.4600028-.70360861c.5166435.39719686.9762801.86487779 1.3645249 1.388658l-.7293289 1.44720284c.2201691.39604534.3936959.82158734.5131582 1.2692035l1.5298263.5338186c.0390082.29913986.0591302.60421522.0591302.91399032 0 .35132769-.0258823.69661025-.0758441 1.03404495l-1.5391112.50785434c-.1273064.44544792-.3083902.86820077-.5357801 1.26078721l.7036087 1.4600028c-.3971969.5166435-.8648778.9762801-1.388658 1.3645249l-1.4472029-.7293289c-.39604532.2201691-.82158732.3936959-1.26920348.5131582l-.5338186 1.5298263c-.29913986.0390082-.60421522.0591302-.91399032.0591302-.35132769 0-.69661025-.0258823-1.03404495-.0758441l-.50785434-1.5391112c-.44544792-.1273064-.86820077-.3083902-1.26078723-.5357801l-1.46000277.7036087c-.51664349-.3971969-.97628006-.8648778-1.36452491-1.388658l.72932886-1.4472029c-.2203328-.39633993-.39395403-.82222042-.51342462-1.27020241l-1.52968981-.53381682c-.03892294-.29882066-.05900023-.60356226-.05900023-.91299317 0-.35132769.02588228-.69661025.07584411-1.03404495l1.53911115-.50785434c.12730646-.44544792.30839026-.86820077.53578009-1.26078723l-.70360861-1.46000277c.39719686-.51664349.86487779-.97628006 1.388658-1.36452491l1.44720284.72932886c.39633995-.2203328.82222044-.39395403 1.27020243-.51342462l.53381682-1.52968981c.29882066-.03892294.60356226-.05900023.91299317-.05900023z" stroke-width=".933"/><circle cx="7.5" cy="7.5" r="3"/></g></svg>',

    // Table (📊)
    table:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14.4978951 12.4978973-.0105089-9.99999996c-.0011648-1.10374784-.8962548-1.99789734-2-1.99789734h-9.99999995c-1.0543629 0-1.91816623.81587779-1.99451537 1.85073766l-.00548463.151365.0105133 10.00000004c.0011604 1.1037478.89625045 1.9978973 1.99999889 1.9978973h9.99999776c1.0543618 0 1.9181652-.8158778 1.9945143-1.8507377z"/><path d="m4.5 4.5v9.817"/><path d="m7-2v14" transform="matrix(0 1 -1 0 12.5 -2.5)"/></g></svg>',

    // External/Document (📄)
    external:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m15.5.5v5h-5" transform="matrix(1 0 0 -1 0 6)"/><path d="m12-.95v9.9" transform="matrix(.70710678 .70710678 -.70710678 .70710678 6.343146 -7.313708)"/><path d="m7.5.5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h11c1.1045695 0 2-.8954305 2-2v-4"/></g></svg>',

    // Link (🔗)
    link: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m5.5 7.5c.96940983 1.36718798 3.01111566 1.12727011 4.01111565 0l1.98888435-2c1.1243486-1.22807966 1.1641276-2.81388365 0-4-1.135619-1.15706921-2.86438099-1.15706947-4 0l-2 2"/><path d="m7.5 6.56977319c-.96940983-1.36718798-3-1.1970433-4-.06977319l-2 1.97487373c-1.12434863 1.22807966-1.16412758 2.83900987 0 4.02512627 1.13561901 1.1570692 2.86438099 1.1570695 4 0l2-2"/></g></svg>',

    // Broken Link (🔗✗)
    brokenLink:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m7.5 5.32842712 1-1c1.1045695-1.10456949 2.8954305-1.10456949 4 0 1.1045695 1.1045695 1.1045695 2.89543051 0 4l-1 1m-3.17157288 3.17157288-1 1c-1.10456949 1.1045695-2.8954305 1.1045695-4 0-1.10456949-1.1045695-1.10456949-2.8954305 0-4l1-1"/><path d="m5.5 3.5v-3"/><path d="m.5 5.5h3"/><path d="m11.5 16.5v-3"/><path d="m13.5 11.5h3"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // Navigation Arrows
    // ═══════════════════════════════════════════════════════════════════════

    // Arrow Right (→)
    arrowRight:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 8.5 4-4-4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(9 6)"/></svg>',

    // Arrow Left (←)
    arrowLeft:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m4.5 8.5-4-4 4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(7 6)"/></svg>',

    // Arrow Down (↓)
    arrowDown:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m8.5.5 4 4-4 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="rotate(90 10.5 10.5)"/></svg>',

    // Arrow Up (↑)
    arrowUp:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m8.5.5-4 4 4 4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="rotate(90 10.5 10.5)"/></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // Storage & Files
    // ═══════════════════════════════════════════════════════════════════════

    // Disk/Save (💾)
    disk: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg>',

    // Document/Memo (📝)
    document:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m12.5 12.5v-7l-5-5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m2.5 7.5h5"/><path d="m2.5 9.5h7"/><path d="m2.5 11.5h3"/><path d="m7.5.5v3c0 1.1045695.8954305 2 2 2h3"/></g></svg>',

    // Folder (📁)
    folder:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 4)"><path d="m15.5 4.5c.000802-1.10737712-.8946285-2.00280762-1.999198-2.00280762l-5.000802.00280762-2-2h-4c-.55228475 0-1 .44771525-1 1v.99719238 2.00280762"/><path d="m.81056316 5.74177845 1.31072322 5.24326075c.22257179.8903496 1.02254541 1.5149608 1.94029301 1.5149608h8.87667761c.9177969 0 1.7178001-.6246768 1.9403251-1.5150889l1.3108108-5.24508337c.1339045-.53580596-.1919011-1.07871356-.727707-1.21261805-.079341-.0198283-.1608148-.02983749-.2425959-.02983749l-13.43852073.00188666c-.55228474.00007754-.99985959.44785564-.99985959 1.00014038 0 .08170931.01003737.16310922.02985348.24237922z"/></g></svg>',

    // Inbox/Import (📥/📂)
    inbox:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2.5 1.5)"><path d="m10 3h2.3406038c.4000282 0 .7615663.23839685.9191451.6060807l2.7402511 6.3939193v4c0 1.1045695-.8954305 2-2 2h-12c-1.1045695 0-2-.8954305-2-2v-4l2.74025113-6.3939193c.15757879-.36768385.51911692-.6060807.91914503-.6060807h2.34060384"/><path d="m11 6.086-3 2.914-3-2.914"/><path d="m8 0v9"/><path d="m0 10h4c.55228475 0 1 .4477153 1 1v1c0 .5522847.44771525 1 1 1h4c.5522847 0 1-.4477153 1-1v-1c0-.5522847.4477153-1 1-1h4"/></g></svg>',

    // Clipboard/List (📋)
    clipboard:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m3.5 1.5c-.44119105-.00021714-1.03893772-.0044496-1.99754087-.00501204-.51283429-.00116132-.93645365.3838383-.99544161.88103343l-.00701752.11906336v10.99753785c.00061498.5520447.44795562.9996604 1 1.0006148l10 .0061982c.5128356.0008356.9357441-.3849039.993815-.882204l.006185-.1172316v-11c0-.55228475-.4477152-1-1-1-.8704853-.00042798-1.56475733.00021399-2 0"/><path d="m4.5.5h4c.55228475 0 1 .44771525 1 1s-.44771525 1-1 1h-4c-.55228475 0-1-.44771525-1-1s.44771525-1 1-1z"/><path d="m2.5 5.5h5"/><path d="m2.5 7.5h7"/><path d="m2.5 9.5h3"/><path d="m2.5 11.5h6"/></g></svg>',

    // Pencil/Edit (✏️)
    pencil:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z"/><path d="m12.5 3.5 1 1"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // File Types
    // ═══════════════════════════════════════════════════════════════════════

    // PDF (📄)
    pdf: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(1 2)"><path d="m16.5 12.5v-10c0-1.1045695-.8954305-2-2-2h-8c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m4.30542777 2.93478874-2.00419132.72946598c-1.03795581.37778502-1.57312998 1.52546972-1.19534496 2.56342553l3.42020143 9.39692625c.37778502 1.0379558 1.52546972 1.5731299 2.56342553 1.1953449l5.56843115-2.1980811"/><path d="m7.5 5.5h5"/><path d="m7.5 7.5h6"/><path d="m7.5 9.5h3"/></g></svg>',

    // HTML (🌐)
    html: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 3)"><path d="m8 16c4.4380025 0 8-3.5262833 8-7.96428571 0-4.43800246-3.5619975-8.03571429-8-8.03571429-4.43800245 0-8 3.59771183-8 8.03571429 0 4.43800241 3.56199755 7.96428571 8 7.96428571z"/><path d="m1 5h14"/><path d="m1 11h14"/><path d="m8 16c2.2190012 0 4-3.5262833 4-7.96428571 0-4.43800246-1.7809988-8.03571429-4-8.03571429-2.21900123 0-4 3.59771183-4 8.03571429 0 4.43800241 1.78099877 7.96428571 4 7.96428571z"/></g></svg>',

    // Code/Markup (</> for Code view)
    code: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 3)"><path d="m10.5 14.5 4-4.5-4-4.5"/><path d="m6.5 5.5-4 4.5 4 4.5"/></g></svg>',

    // OCR/Text Recognition (🔍📄)
    ocr: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m3.5 7.5h8"/><path d="m3.5 10.5h6"/><path d="m.5 3.5v-3h3"/><path d="m14.5 3.5v-3h-3"/><path d="m.5 11.5v3h3"/><path d="m14.5 11.5v3h-3"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // View Controls
    // ═══════════════════════════════════════════════════════════════════════

    // Eye/Preview (👁️)
    eye: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 5)"><path d="m8.5 11c3.1296136 0 5.9629469-1.83333333 8.5-5.5-2.5370531-3.66666667-5.3703864-5.5-8.5-5.5-3.12961358 0-5.96294692 1.83333333-8.5 5.5 2.53705308 3.66666667 5.37038642 5.5 8.5 5.5z"/><path d="m8.5 2c.18463928 0 .36593924.01429736.54285316.04184538-.02850842.148891-.04285316.30184762-.04285316.45815462 0 1.38071187 1.1192881 2.5 2.5 2.5.156307 0 .3092636-.01434474.4576252-.04178957.0280774.17585033.0423748.35715029.0423748.54178957 0 1.93299662-1.5670034 3.5-3.5 3.5-1.93299662 0-3.5-1.56700338-3.5-3.5s1.56700338-3.5 3.5-3.5z"/></g></svg>',

    // Split View (☰)
    split:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 5)"><path d="m12.5.5h-10.00000001c-1.1045695 0-2 .8954305-2 2v6c0 1.1045695.8954305 2 2 2h10.00000001c1.1045695 0 2-.8954305 2-2v-6c0-1.1045695-.8954305-2-2-2z"/><path d="m7.5.5v10"/></g></svg>',

    // Fullscreen Enter (⛶)
    fullscreenEnter:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m16.5 5.5v-4.978l-5.5.014"/><path d="m16.5.522-6 5.907"/><path d="m11 16.521 5.5.002-.013-5.5"/><path d="m16.5 16.429-6-5.907"/><path d="m.5 5.5v-5h5.5"/><path d="m6.5 6.429-6-5.907"/><path d="m6 16.516-5.5.007v-5.023"/><path d="m6.5 10.5-6 6"/></g></svg>',

    // Fullscreen Exit (⛛)
    fullscreenExit:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m.5 4.5 4.5-.013-.013-4.5"/><path d="m5 4.5-4.5-4"/><path d="m.5 8.5 4.5.014.013 4.5"/><path d="m5 8.5-4.5 4"/><path d="m12.5 4.5-4.5-.013.013-4.5"/><path d="m8 4.5 4.5-4"/><path d="m12.5 8.5-4.5.014-.013 4.5"/><path d="m8 8.5 4.5 4"/></g></svg>',

    // Zoom In (+)
    zoomIn:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><circle cx="5.5" cy="5.5" r="5"/><path d="m7.5 5.5h-4zm-2 2v-4z"/><path d="m14.5 14.5-5.367-5.367"/></g></svg>',

    // Zoom Out (−)
    zoomOut:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><circle cx="5.5" cy="5.5" r="5"/><path d="m7.5 5.5h-4z"/><path d="m14.571 14.5-5.45-5.381"/></g></svg>',

    // Size/Scale (📐)
    size: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14.5 4.5v-4h-4"/><path d="m6.5 4.5v4h4"/><path d="m10.5-1.157v11.314" transform="matrix(.70710678 .70710678 -.70710678 .70710678 6.257359 -6.106602)"/><path d="m8.5.5h-6c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-6"/></g></svg>',

    // Fit/Wide (↔️)
    fit: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(1.228 .814)"><path d="m14.279 13.701 4-4-4-4.015"/><path d="m4.279 13.701-4-4 4-4.015"/><path d="m15.636 3.322-12.728 12.728" transform="matrix(.70710678 .70710678 -.70710678 .70710678 9.564742 -3.71933)"/></g></svg>',

    // Maximise/Expand (⬌ for viewport fit)
    maximise:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m5.5.5h-3c-1.1045695 0-2 .8954305-2 2v3"/><path d="m.5 11.5v3c0 1.1045695.8954305 2 2 2h3"/><path d="m11.5 16.5h3c1.1045695 0 2-.8954305 2-2v-3"/><path d="m16.5 5.5v-3c0-1.1045695-.8954305-2-2-2h-3"/></g></svg>',

    // Chart/Stats (📊)
    chart:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m2.5.5h10c1.1045695 0 2 .8954305 2 2v10c0 1.1045695-.8954305 2-2 2h-10c-1.1045695 0-2-.8954305-2-2v-10c0-1.1045695.8954305-2 2-2z"/><path d="m4.5 11.435v-7.935"/><path d="m7.5 11.485v-3.985"/><path d="m10.5 11.5v-6"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // Media & Capture
    // ═══════════════════════════════════════════════════════════════════════

    // Camera/Photo (📷)
    camera:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 4)"><path d="m.5 10.5v-6c0-1.1045695.8954305-2 2-2h2l2.07861328-2h3.92016602l1.9194336 2h2.0817871c1.1045695 0 2 .8954305 2 2v6c0 1.1045695-.8954305 2-2 2h-12c-1.1045695 0-2-.8954305-2-2z"/><path d="m11.5 7.5c0-1.65685425-1.3431458-3-3-3-1.65685425 0-3 1.34314575-3 3s1.34314575 3 3 3c1.6568542 0 3-1.34314575 3-3z"/></g></svg>',

    // Image/Picture (🖼️)
    image:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(3 3)"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5.5h10c1.1045695 0 2 .8954305 2 2v10c0 1.1045695-.8954305 2-2 2h-10c-1.1045695 0-2-.8954305-2-2v-10c0-1.1045695.8954305-2 2-2z"/><path d="m14.5 10.5-3-3-3 2.985"/><path d="m12.5 14.5-9-9-3 3"/></g><circle cx="11" cy="4" fill="currentColor" r="1"/></g></svg>',

    // Flip/Mirror (🔀)
    flip: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m8.5.5v16"/><path d="m.5 8.5h7v-7h-7z"/><path d="m9.5 8.5h7v7h-7z"/></g></svg>',

    // Missing Alt Text (🖼️✏️)
    missingAlt:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 3)"><rect x=".5" y=".5" width="9" height="11" rx="1"/><path d="m1.5 9.5 2.5-3.5 2 2 2.5-3"/><circle cx="7" cy="3" r="1"/><path d="m10.5 10.5-1 3 3-1 5-5c.6-.6.6-1.4 0-2-.6-.6-1.4-.6-2 0z"/><path d="m13.5 6.5 1 1"/></g></svg>',

    // Palette/Art (🎨)
    palette:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(1 2)"><ellipse cx="9.5" cy="8.5" rx="9" ry="7.5"/><ellipse cx="5" cy="10.5" rx="2" ry="1.5"/><circle cx="13" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor"/><circle cx="14" cy="9" r="1.5" fill="currentColor"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // Status & Security
    // ═══════════════════════════════════════════════════════════════════════

    // Lock (🔒)
    lock: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(4 1)"><path d="m2.5 8.5-.00586729-1.99475098c-.00728549-4.00349935 1.32800361-6.00524902 4.00586729-6.00524902s4.0112203 2.00174967 4.0000699 6.00524902v1.99475098m-8.0000699 0h8.0225317c1.0543618 0 1.9181652.81587779 1.9945143 1.8507377l.0054778.1548972-.0169048 6c-.0031058 1.1023652-.8976224 1.9943651-1.999992 1.9943651h-8.005627c-1.1045695 0-2-.8954305-2-2v-6c0-1.1045695.8954305-2 2-2z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="13.5" fill="currentColor" r="1.5"/></g></svg>',

    // Shield/Protection (🛡️)
    shield:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m12.8571123 1.79063546c-3.70547974-2.40636667-8.66011018-1.35322746-11.06647684 2.35225226-2.40636667 3.70547972-1.35322746 8.66011018 2.35225226 11.06647678 1.40713892.9138067 2.9944136 1.3287299 4.55387082 1.2889715 2.54712886-.0649393 5.02004606-1.3428829 6.51260596-3.6412237 1.5774991-2.4291355 1.6682799-5.39509184.4997393-7.82805117"/><path d="m4.5 7.5 3 3 8-8"/></g></svg>',

    // Hourglass/Pending (⏳)
    hourglass:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="matrix(-1 0 0 1 19 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m8.5 5.5v4h-3.5"/></g></svg>',
    // Database/Storage (🗄️)
    database:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 2)"><ellipse cx="7.5" cy="2.5" rx="7" ry="2.5"/><path d="m.5 5c0 1.3807119 3.1339746 2.5 7 2.5s7-1.1192881 7-2.5"/><path d="m.5 8c0 1.3807119 3.1339746 2.5 7 2.5s7-1.1192881 7-2.5"/><path d="m.5 11c0 1.3807119 3.1339746 2.5 7 2.5s7-1.1192881 7-2.5"/><path d="m14.5 2.5v11c0 1.3807119-3.1339746 2.5-7 2.5s-7-1.1192881-7-2.5v-11"/></g></svg>',

    // Clock/Time (🕐)
    clock:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m8.5 5.5v3h3"/></g></svg>',

    // ═══════════════════════════════════════════════════════════════════════
    // AI & Technology
    // ═══════════════════════════════════════════════════════════════════════

    // AI Sparkle (✨🤖)
    aiSparkle:
      '<svg height="21" width="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1.0685 0 0 .99925 .39221 2.2062)" fill="none" fill-rule="evenodd"><path d="m0.5 15v-11.8c0-1.6 1.3-2.9 3-2.9h6.3m4.5 7.7v7c0 1.6-1.3 2.9-3 2.9h-7.8c-1.6 0-3-1.3-3-2.9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m12.2-1.9q0.7 6 6.8 6-6.1 0-6.8 6-0.7-6-6.8-6 6.1 0 6.8-6z" fill="currentColor"/><path d="m6.1 6.8q0.6 4.8 5.7 4.8-5.1 0-5.7 4.8-0.6-4.8-5.7-4.8 5.1 0 5.7-4.8z" fill="currentColor"/><path d="m15.8-1.7q0.2 1.5 1.7 1.5-1.5 0-1.7 1.5-0.2-1.5-1.7-1.5 1.5 0 1.7-1.5z" fill="currentColor"/></g></svg>',

    // Robot/Model (🤖)
    robot:
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 4)"><path d="m4.5 0c.55228475 0 1 .44771525 1 1v2c0 .55228475-.44771525 1-1 1s-1-.44771525-1-1v-2c0-.55228475.44771525-1 1-1z"/><path d="m16.5 2h-11"/><path d="m3.5 2h-3"/><path d="m4.5 10c.55228475 0 1 .4477153 1 1v2c0 .5522847-.44771525 1-1 1s-1-.4477153-1-1v-2c0-.5522847.44771525-1 1-1z"/><path d="m16.5 12h-11"/><path d="m3.5 12h-3"/><path d="m12.5 5c.5522847 0 1 .44771525 1 1v2c0 .55228475-.4477153 1-1 1s-1-.44771525-1-1v-2c0-.55228475.4477153-1 1-1z"/><path d="m11.5 7h-11"/><path d="m16.5 7h-3"/></g></svg>',
  };

  /**
   * Get an SVG icon by name with accessibility attributes
   * @param {string} name - Icon name from ICONS registry
   * @param {Object} [options] - Options
   * @param {string} [options.className] - Additional CSS class(es)
   * @returns {string} SVG HTML string with aria-hidden="true" and icon class
   */
  function getIcon(name, options = {}) {
    const svg = ICONS[name];
    if (!svg) {
      console.warn(`[IconLibrary] Unknown icon requested: "${name}"`);
      return "";
    }

    const className = options.className
      ? `class="icon ${options.className}"`
      : 'class="icon"';

    // Insert aria-hidden and class into the SVG opening tag
    return svg.replace("<svg", `<svg aria-hidden="true" ${className}`);
  }

  /**
   * Populate all elements with data-icon attribute with their corresponding SVG
   * Call this after DOM is ready or after dynamically adding icon elements
   */
  function populateIcons() {
    const iconElements = document.querySelectorAll("[data-icon]");
    let populatedCount = 0;
    let errorCount = 0;

    iconElements.forEach((element) => {
      const iconName = element.dataset.icon;
      const svg = ICONS[iconName];

      if (svg) {
        // Get any custom class from the element
        const customClass = element.dataset.iconClass || "";
        const className = customClass
          ? `class="icon ${customClass}"`
          : 'class="icon"';

        // Replace element content with the SVG
        element.innerHTML = svg.replace(
          "<svg",
          `<svg aria-hidden="true" ${className}`,
        );
        populatedCount++;
      } else {
        console.warn(`[IconLibrary] Unknown icon in data-icon: "${iconName}"`);
        errorCount++;
      }
    });

    if (populatedCount > 0 || errorCount > 0) {
      console.log(
        `[IconLibrary] Populated ${populatedCount} icons${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      );
    }
  }

  /**
   * Get list of all available icon names
   * @returns {string[]} Array of icon names
   */
  function getAvailableIcons() {
    return Object.keys(ICONS);
  }

  /**
   * Check if an icon exists in the registry
   * @param {string} name - Icon name to check
   * @returns {boolean} True if icon exists
   */
  function hasIcon(name) {
    return ICONS.hasOwnProperty(name);
  }

  // Auto-populate icons on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", populateIcons);
  } else {
    // DOM already loaded, populate immediately
    populateIcons();
  }

  // Expose API globally
  window.IconLibrary = {
    getIcon: getIcon,
    populateIcons: populateIcons,
    getAvailableIcons: getAvailableIcons,
    hasIcon: hasIcon,
    ICONS: ICONS, // Expose registry for advanced usage
  };

  // Also expose getIcon directly for convenience
  window.getIcon = getIcon;
})();
