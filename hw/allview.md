# Install APK  https://www.apkmirror.com/apk/mozilla/firefox/firefox-68-11-0-release/firefox-browser-fast-private-68-11-0-android-apk-download/download/?key=a4365f2880947c148d650c765567988b695dfce5

adb install -r firefox-68.11.0-armeabi-v7a.apk

# Servicii și magazin Google
adb shell pm disable-user --user 0 com.google.android.gms
adb shell pm disable-user --user 0 com.google.android.gsf
adb shell pm disable-user --user 0 com.google.android.gsf.login
adb shell pm disable-user --user 0 com.android.vending
adb shell pm disable-user --user 0 com.google.android.googlequicksearchbox
adb shell pm disable-user --user 0 com.google.android.backuptransport
adb shell pm disable-user --user 0 com.google.android.partnersetup
adb shell pm disable-user --user 0 com.google.android.setupwizard
adb shell pm disable-user --user 0 com.android.provision

# Aplicații Google / AOSP media, cloud și comunicare inutile pe un ecran de cotații
adb shell pm disable-user --user 0 com.google.android.apps.plus
adb shell pm disable-user --user 0 com.google.android.videos
adb shell pm disable-user --user 0 com.google.android.music
adb shell pm disable-user --user 0 com.android.music
adb shell pm disable-user --user 0 com.android.gallery3d
adb shell pm disable-user --user 0 com.android.deskclock
adb shell pm disable-user --user 0 com.android.calculator2
adb shell pm disable-user --user 0 com.android.calendar
adb shell pm disable-user --user 0 com.google.android.calendar
adb shell pm disable-user --user 0 com.android.contacts
adb shell pm disable-user --user 0 com.google.android.providers.contacts
adb shell pm disable-user --user 0 com.android.email
adb shell pm disable-user --user 0 com.android.exchange
adb shell pm disable-user --user 0 com.google.android.gm
adb shell pm disable-user --user 0 com.android.mms
adb shell pm disable-user --user 0 com.android.cellbroadcastreceiver
adb shell pm disable-user --user 0 com.android.printspooler
adb shell pm disable-user --user 0 com.android.dreams.basic
adb shell pm disable-user --user 0 com.android.dreams.phototable
adb shell pm disable-user --user 0 com.android.wallpaper
adb shell pm disable-user --user 0 com.android.wallpaper.holospiral
adb shell pm disable-user --user 0 com.android.magicsmoke
adb shell pm disable-user --user 0 com.android.phasebeam
adb shell pm disable-user --user 0 com.android.visualization
adb shell pm disable-user --user 0 com.android.noisefield


adb shell cat /proc/meminfo | head -n 5

