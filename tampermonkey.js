// ==UserScript==
// @name         Zipwhip Plugin Bootstrapper for App Store abc
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://app.zipwhip.com/*
// @grant        none
// ==/UserScript==

console.log("Plugin - Pre-run");
setTimeout(function() {

    console.log("Plugin - Bootsrapper running...");

    var script = document.createElement('script');

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
        var DONE = 4; // readyState 4 means the request is done.
        var OK = 200; // status 200 is a successful return.
        if (xhr.readyState === DONE) {
            if (xhr.status === OK) {
                console.log("Plugin - Got boot.js downloaded"); // 'This is the returned text.'
                script.text = xhr.responseText;
                document.getElementsByTagName('head')[0].appendChild(script);

            } else {
                console.log('Error: ' + xhr.status); // An error occurred during the request.
            }
        }
    };

    xhr.open('GET', 'https://raw.githubusercontent.com/dfreddolino/zw-plugin-bootstrap/master/boot.js');
    xhr.send(null);

    console.log("Plugin - Bootsrapper ran");
}, 1000);
