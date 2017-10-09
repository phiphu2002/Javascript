1) checking FreePBX
-------------------
- Admin -> REST API
- Settings -> Asterisk Rest Interface User; add asterisk/asterisk; Read Only = No
- Settings -> Advanced Settings; Enable the Asterisk Interface = Yes; Pretty Print JSON Responses = Yes

2) Checking os
--------------
cat /etc/centos-release
lsb_release -d

SHMZ release 6.6

3) Installing nodejs
-------------------
node: 5.x
or run directly from https://nodejs.org/download/release/v5.12.0/node-v5.12.0.tar.gz

4) installing socket.io
-----------------------
version 2.0.3

5) installing ari-client
------------------------

6) deploying Solution
---------------------
6.1) deploying Asterisk Adapter module
"FITi_Asterisk_Adapter_watcher" make sure that "FITi_Asterisk_Adapter_Dev.js" always running
You can put "FITi_Asterisk_Adapter_watcher" in /etc/rc.local

6.2) deploying CRM Adapter module
Refer to "AsteriskCtiDemo.html"
