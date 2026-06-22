const path = require('path');
const R = require('./.next/dev/server/chunks/[turbopack]_runtime.js');
R.r('server/app/api/auth/login/route.js');
const m = R.m('[project]/node_modules/next/dist/esm/build/templates/app-route.js { INNER_APP_ROUTE => "[project]/src/app/api/auth/login/route.js [app-route] (ecmascript)" } [app-route] (ecmascript)');
console.log('Exports:', Object.keys(m.exports));
console.log('routeModule:', typeof m.exports.routeModule);
if (m.exports.routeModule) {
  console.log('handle:', typeof m.exports.routeModule.handle);
}
