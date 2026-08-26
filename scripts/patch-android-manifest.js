/* Health Connect, uygulamayi ancak manifestinde "izin gerekcesi" ekranini
   tanimladiysa listesine alir. Bu tanim olmadan uygulama Health Connect'in
   izin listesinde hic gorunmez, dolayisiyla izin de verilemez.

   android/ klasoru her derlemede yeniden uretildigi icin yama burada,
   betikle uygulaniyor. Betik tekrar calistirilabilir: zaten varsa dokunmaz. */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(file, 'utf8');

const RATIONALE = `
        <!-- Health Connect izin gerekcesi — Android 13 ve oncesi -->
        <activity
            android:name="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>

        <!-- Health Connect izin gerekcesi — Android 14 ve sonrasi -->
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
`;

const QUERIES = `
    <!-- Android 11+ paket gorunurlugu: Health Connect'i sorgulayabilmek icin -->
    <queries>
        <package android:name="com.google.android.apps.healthdata" />
    </queries>
`;

let degisti = false;

if (!xml.includes('PermissionsRationaleActivity')) {
  xml = xml.replace('    </application>', RATIONALE + '    </application>');
  degisti = true;
}
if (!xml.includes('com.google.android.apps.healthdata')) {
  xml = xml.replace('</manifest>', QUERIES + '</manifest>');
  degisti = true;
}

if (degisti) {
  fs.writeFileSync(file, xml);
  console.log('AndroidManifest yamalandi: Health Connect gerekce ekrani + paket gorunurlugu');
} else {
  console.log('AndroidManifest zaten yamali');
}

// Dogrula
const son = fs.readFileSync(file, 'utf8');
for (const beklenen of ['PermissionsRationaleActivity', 'VIEW_PERMISSION_USAGE',
                        'HEALTH_PERMISSIONS', 'com.google.android.apps.healthdata']) {
  if (!son.includes(beklenen)) {
    console.error('YAMA EKSIK: ' + beklenen);
    process.exit(1);
  }
}
console.log('dogrulandi');
