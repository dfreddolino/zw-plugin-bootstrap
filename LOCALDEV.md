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



If using Babel so that you can write advanced Javascript, but dumb it down for broad set of browsers...

While you can install Babel CLI globally on your machine, it's much better to install it locally project by project.

Different projects on the same machine can depend on different versions of Babel allowing you to update one at a time.
It means you do not have an implicit dependency on the environment you are working in. Making your project far more portable and easier to setup.
We can install Babel CLI locally by running:

npm install --save-dev @babel/core @babel/cli

Note: If you do not have a package.json, create one before installing. This will ensure proper interaction with the npx command.

After that finishes installing, your package.json file should include:

{
  "devDependencies": {
+   "@babel/cli": "^7.0.0",
+   "@babel/core": "^7.0.0"
  }
}

Usage
Instead of running Babel directly from the command line we're going to put our commands in npm scripts which will use our local version.

Simply add a "scripts" field to your package.json and put the babel command inside there as build.

  {
    "name": "my-project",
    "version": "1.0.0",
+   "scripts": {
+     "build": "babel src -d lib"
+   },
    "devDependencies": {
      "babel-cli": "^6.0.0"
    }
  }

Now from our terminal we can run:

npm run build

This will run Babel the same way as before and the output will be present in lib directory, only now we are using a local copy.

Alternatively, you can reference the babel cli inside of node_modules.

./node_modules/.bin/babel src -d lib
