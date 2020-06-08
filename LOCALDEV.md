You need to dish up your code in real-time to the Zipwhip boot.js
script to load your plugin into the Zipwhip web app.

We recomend you use a localhost web server to dish up your local
plugin.js while developing your code.

If you're doing local development, you can change your jsUrl in the
Zipwhip App Store configuration to be your localhost URL while
you are developing. Or, you can make two entries in the Zipwhip App
Store, one for production and one for local dev.

To change your jsUrl:
http://

To install:
npm install http-server -g

To run on PC (turn on cors, turn off caching):
http-server.cmd --cors -c-1

To run on Mac/Linux (turn on cors, turn off caching):
http-server --cors -c-1

Then visit:
http://localhost:8080/plugin.js

Or, if working on multiple projects...

To run on PC (turn on cors, turn off caching):
cd ..
http-server.cmd --cors -c-1

Then visit:
http://localhost:8080/myPluginFolder/plugin.js
