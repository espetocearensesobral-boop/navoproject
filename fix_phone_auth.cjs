const fs = require('fs');
let code = fs.readFileSync('backend/routers/appointments.router.ts', 'utf8');

// Require exact bookingCode for isLookupMatch in cancel/edit
code = code.replace(
/const isLookupMatch = reqPhone && dbApt\.clientPhone && matchPhoneNumbers\(reqPhone, dbApt\.clientPhone\) &&\s*reqCode && dbApt\.bookingCode && reqCode\.toUpperCase\(\)\.trim\(\) === dbApt\.bookingCode\.toUpperCase\(\)\.trim\(\);/g,
`const isLookupMatch = reqPhone && dbApt.clientPhone && matchPhoneNumbers(reqPhone, dbApt.clientPhone) &&
                            reqCode && dbApt.bookingCode && reqCode.toUpperCase().trim() === dbApt.bookingCode.toUpperCase().trim();`
);

fs.writeFileSync('backend/routers/appointments.router.ts', code);
console.log('Checked appointments router');
