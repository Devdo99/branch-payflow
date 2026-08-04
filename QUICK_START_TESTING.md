# 🧪 Quick Start Testing Guide - HR Module Fixes

**Last Updated:** 04 Agustus 2026

---

## 🚀 Quick Test Scenarios

### Scenario 1: Test Approval Confirmation (Admin)
**URL:** `http://localhost:3000/hr/request-cuti`

**Steps:**
1. Look for leave requests with status "Diajukan"
2. Click "Setujui" button
3. **Expected:** Approval confirmation dialog appears with:
   - Employee name and branch
   - Leave type
   - Date range and total days
   - Explanation that notification will be created
4. Click "Setujui & Buat Notifikasi"
5. **Expected:** Dialog closes, status changes to "Disetujui", toast shows success

---

### Scenario 2: Test Date Validation (Public Form)
**URL:** `http://localhost:3000/request-cuti`

**Steps:**
1. Enter valid WhatsApp number (must be registered employee)
2. Click "Lanjutkan"
3. On form page:
   - Try to select a date before today
   - **Expected:** Date picker disables past dates
4. In "Tanggal Selesai" field:
   - Set start date to tomorrow
   - Try to set end date to today
   - **Expected:** End date automatically updates to match or after start date

---

### Scenario 3: Test Submission Confirmation
**URL:** `http://localhost:3000/request-cuti`

**Steps:**
1. Complete leave request form:
   - Select employee (WhatsApp lookup)
   - Select leave type
   - Select dates (must be future dates)
   - Add reason (if required)
2. Click "Kirim Permohonan"
3. **Expected:** Confirmation dialog appears showing:
   - Employee name and WhatsApp (masked)
   - Leave type
   - Date range and number of days
   - Reason (if provided)
   - Explanation that admin will verify
4. Click "Kirim Permohonan" in dialog
5. **Expected:** 
   - Dialog closes
   - Shows success page or automatic rejection if quota full
   - Toast notification appears

---

### Scenario 4: Test Export Loading (Rekap Cuti)
**URL:** `http://localhost:3000/hr/rekap-cuti`

**Steps:**
1. Click "Excel" button
2. **Expected:**
   - Button shows loading spinner
   - Text changes to "Mengekspor..."
   - Button is disabled (grayed out)
3. Wait for export to complete
4. **Expected:**
   - Success toast: "Data berhasil diekspor ke Excel."
   - Button returns to normal state
   - CSV file downloads

---

### Scenario 5: Test Export Loading (Kalender Cuti)
**URL:** `http://localhost:3000/hr/kalender-cuti`

**Steps:**
1. Click "PDF" button
2. **Expected:** Same loading behavior as Excel export
3. Wait for export to complete
4. **Expected:**
   - Success toast appears
   - PDF file downloads
   - Button returns to normal state

---

## ✅ Validation Checklist

### Request Cuti Admin - Approval Flow
- [ ] Approval dialog appears when clicking "Setujui"
- [ ] Dialog shows correct employee info
- [ ] Dialog shows date range and total days
- [ ] Can cancel without changes
- [ ] Clicking approve creates notification
- [ ] Toast shows "Permohonan cuti disetujui"
- [ ] Request status changes to "Disetujui"

### Request Cuti Public - Date Validation
- [ ] Cannot select dates before today via date picker
- [ ] If trying to set invalid range, gets error message
- [ ] Start date auto-updates if end date is earlier
- [ ] Confirmation dialog shows all entered data
- [ ] Can edit form before final submission
- [ ] Phone number is masked in confirmation

### Request Cuti Public - Submission
- [ ] Confirmation dialog appears before submission
- [ ] All form data visible in confirmation
- [ ] Can cancel from confirmation dialog
- [ ] After submission, success page or rejection page appears
- [ ] Toast notification appears
- [ ] If quota full, shows rejection reason

### Export Loading States
- [ ] Export button shows spinner icon
- [ ] Button text changes to "Mengekspor..."
- [ ] Button is disabled (cannot click again)
- [ ] After export completes, button returns to normal
- [ ] Success toast appears
- [ ] File downloads to computer

### Branch Filter
- [ ] Filter dropdown shows all branches
- [ ] Selecting branch filters data correctly
- [ ] Filter persists when navigating
- [ ] Shows current selection clearly

### Empty States
- [ ] When no data, shows "Tidak ada..." message
- [ ] Message is centered and clear
- [ ] Loading spinner shows while fetching

---

## 🐛 Common Issues & Troubleshooting

### Issue: Date picker still allows past dates
**Cause:** Browser cache or JavaScript disabled
**Fix:** Clear browser cache and reload page

### Issue: Confirmation dialog doesn't appear
**Cause:** JavaScript error or browser console issue
**Fix:** Check browser console for errors, refresh page

### Issue: Export button stays in loading state
**Cause:** Network issue or export function error
**Fix:** Check browser console, refresh page, check internet connection

### Issue: Phone number not masked in confirmation
**Cause:** maskPhone function might have issue
**Fix:** Check that WhatsApp number field has value

### Issue: Toast notification doesn't appear
**Cause:** Sonner toast library issue
**Fix:** Check browser console, clear cache, restart browser

---

## 📊 Test Results Template

Copy this to record your testing results:

```
Test Date: __________________
Tester Name: __________________
Browser: __________________ Version: __________
Device: __________________

APPROVAL CONFIRMATION
- [ ] Dialog appears correctly
- [ ] Employee info displays
- [ ] Dates show correctly
- [ ] Can cancel approval
- [ ] Approval creates notification
Result: ___________________

DATE VALIDATION
- [ ] Past dates disabled
- [ ] End date >= start date
- [ ] Range validation works
Result: ___________________

SUBMISSION CONFIRMATION
- [ ] Dialog shows all data
- [ ] Phone masked
- [ ] Can cancel
- [ ] Submission works
Result: ___________________

EXPORT LOADING
- [ ] Spinner shows
- [ ] Button disabled
- [ ] File downloads
- [ ] Success toast
Result: ___________________

OVERALL STATUS: [ ] PASS [ ] FAIL [ ] NEEDS INVESTIGATION
Comments: ___________________________________
```

---

## 🔗 Related Documentation

- `TESTING_UI_UX_REPORT.md` - Full UI/UX testing report
- `HR_FIXES_SUMMARY.md` - Detailed implementation notes
- `HR_MODULE_COMPLETION_REPORT.md` - Executive summary

---

## 💡 Tips for Testing

1. **Test on multiple browsers** - Chrome, Firefox, Safari, Edge
2. **Test on mobile devices** - Especially the date picker
3. **Test with slow network** - Use browser dev tools throttle feature
4. **Test with large datasets** - Many leave records to see performance
5. **Test edge cases** - Leap years, month boundaries, timezone changes
6. **Check console** - Look for JavaScript errors
7. **Check network tab** - Verify API calls succeed
8. **Test with different users** - Different branches, roles

---

## 📞 Need Help?

1. Check the error message in toast or console
2. Review the implementation notes in `HR_FIXES_SUMMARY.md`
3. Check browser developer tools console for JavaScript errors
4. Verify database is accessible
5. Check Supabase connection status

---

**Last Updated:** 04 Agustus 2026  
**Status:** Ready for Testing ✅
