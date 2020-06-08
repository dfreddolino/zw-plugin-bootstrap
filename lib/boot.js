// This is the boot code for the Zipwhip Plugins
// Need to load JQuery first
console.log("Plugin - Loading JQuery...");
var script = document.createElement('script');
script.setAttribute('src', 'https://code.jquery.com/jquery-3.4.1.min.js');
script.setAttribute('type', 'text/javascript');
document.getElementsByTagName('head')[0].appendChild(script);
console.log("Plugin - JQuery loaded..."); // This is the object that eventually Zipwhip core engineering should expose to us
// These are methods we will need for our plugins to function

var zw = {
  // Returns the sessionkey currently in use
  getSessionKey: function () {
    return this.getCookie("zw-session");
  },
  // Return the username@line of the user logged in
  getUsernameAtLine: function () {
    return this.getCookie("identity");
  },
  // Return the line of the user logged in
  getLine: function () {
    var userAtLine = this.getUsernameAtLine();

    if (userAtLine.match(/^.*@(.*)$/)) {
      return RegExp.$1;
    }

    return null;
  },
  // Gets a cookie by name
  getCookie: function (name) {
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');

    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];

      while (c.charAt(0) === ' ') c = c.substring(1, c.length);

      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }

    return null;
  },
  // Gives you current contact id for selected conversation. if no selected convo, return null
  // Async
  getCurrentConversationContactId: function (callback) {
    console.log("looking up contact id of selected convo");
    var el = $('.single-contact-panel_singleContactPanelContainer');
    console.log("parent contact card", el);

    if (el.length == 0) {
      console.log("could not find an open conversation");
      return null;
    }

    var phoneEl = el.find('.zk-styled-text-small.zk-styled-text-primary.zk-styled-text-secondary');
    console.log("phone el:", phoneEl);

    if (phoneEl.length > 0) {
      console.log("found convo");
      var contactPhone = phoneEl.text();
      console.log("contact phone:", contactPhone); // now we have to do an ajax lookup to get contactId from contact phone

      this.getContactIdFromContactPhone(contactPhone, function (contactId) {
        console.log("got callback. contactId:", contactId);
        if (callback) callback(contactId);
      });
    } else {
      console.log("could not find phone number");
      return null;
    }
  },
  // Ajax call to get contact info
  getContactInfoFromPhoneNum: function (phone, callback) {
    console.log("getContactInfoFromPhoneNum. phone:", phone);
    phone = phone.replace(/[^0-9+]/g, ""); // swap anything other than numbers and plus sign for emptiness to get clean phone number. don't u love regular expressions!

    console.log("cleaned up phone number", phone);
    var url = "https://app.zipwhip.com/api/v1/conversation/get?address=ptn%3A%2F%2B1" + phone + "&limit=1&start=0";
    var headersObj = {
      authorization: zw.getSessionKey()
    };
    console.log("url to query for contactid:", url, "headers:", headersObj); // do ajax query and get results. based on the results i'll render stuff.

    $.ajax({
      type: "GET",
      url: url,
      headers: headersObj,
      success: function (data) {
        console.log("got success from ajax call for getContactIdFromContactPhone. data:", data); // now go deep into the object

        /* response: {messages: [,…],…}
        conversation: {id: 396472207207, version: 18, deviceId: 366608407, lastUpdated: "2019-12-13T20:26:26+00:00",…}
        address: "ptn:/+15035752613"
        bcc: null
        cc: null
        class: "com.zipwhip.website.data.dto.Conversation"
        contacts: [{id: 31324856907, version: 1, lastUpdated: "2019-12-13T04:51:56+00:00",…}]
        0: {id: 31324856907, version: 1, lastUpdated: "2019-12-13T04:51:56+00:00",…}
        id: 31324856907
        */

        if ('response' in data) {
          console.log("found response in data", data.response);

          if ('conversation' in data.response && 'contacts' in data.response.conversation && data.response.conversation.contacts.length > 0) {
            var contacts = data.response.conversation.contacts;
            console.log("we have a contacts array in the conversation. good.", contacts);

            if (contacts.length == 1) {
              var contactId = contacts[0].id;
              console.log("got contactId:", contactId); // finally do callback
              // contact, conversation, contactId

              if (callback) callback(contacts[0], data.response.conversation, contactId);
            } else {
              console.error("got back more than one contact id, so treating as error.");
            }
          }
        }
      },
      error: function (err) {
        console.log("got error on ajax. err:", err);
      },
      failure: function (err) {
        console.log("got failure on ajax. err:", err);
      }
    });
  },
  // Ajax call to set contact info
  // You should pass in the same contact object as getContactInfoFromPhoneNum() gives you,
  // but with the updated values you want to save
  saveContactInfo: function (contact, callback) {
    console.log("saveContactInfo. contact:", contact); //https://app.zipwhip.com/api/v1/contact/save?

    var url = "https://app.zipwhip.com/api/v1/contact/save";
    var headersObj = {
      authorization: zw.getSessionKey()
    };
    let formData = new FormData();

    for (let item in contact) {
      formData.append(item.name, item.value);
    }

    console.log("url:", url, "formData:", formData, "headers:", headersObj); //console.log("serialize:", $(formData).serialize());
    // do ajax query and get results. based on the results i'll render stuff.

    $.ajax({
      type: "POST",
      url: url,
      data: contact,
      headers: headersObj,
      success: function (data) {
        console.log("got success from ajax call for saveContactInfo. data:", data);
      },
      error: function (err) {
        console.log("got error on ajax. err:", err);
      },
      failure: function (err) {
        console.log("got failure on ajax. err:", err);
      }
    });
  },
  // Utility function to test parsing of JSON
  tryParseJSON: function (jsonString) {
    try {
      var o = JSON.parse(jsonString); // Handle non-exception-throwing cases:
      // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
      // but... JSON.parse(null) returns null, and typeof null === "object",
      // so we must check for that, too. Thankfully, null is falsey, so this suffices:

      if (o && typeof o === "object") {
        return o;
      }
    } catch (e) {}

    return false;
  },
  // Global storage of registered plugins
  pluginsRegistered: [],
  // The plugin object that Zipwhip should expose to give Plugins a way to tap into the Zipwhip lifecyle
  plugin: {
    // A plugin calls this to register itself.
    // @param obj : An object containing at least a key called name {name: "Your Plugin Name", description: "Your desc" }
    register: function (obj) {
      // check that there's an id in the object
      if ('id' in obj) {// good to go
      } else {
        console.error("You did not provide an id inside your plugin object.", obj);
        return;
      } // For now just store the name in the pluginsArr


      zw.pluginsRegistered[obj.id] = obj;
      return obj;
    },
    // Get the plugin object with all the methods/properties
    get: function (id) {
      return zw.pluginsRegistered[id];
    },
    // A plugin calls this to add CSS globally to the DOM.
    // @param cssStr : A string containing the CSS you want to add to the DOM
    // @return nothing
    addCss: function (cssStr, desc) {
      // add CSS to head of HTML
      $('head').append('<style type="text/css">' + cssStr + '</style>');
      console.log("appended " + desc + " plugin CSS to head of doc");
    },
    // A plugin calls this to add CSS globally to the DOM via a URL
    // @param cssUrl : A URL containing the CSS you want to add to the DOM
    // @return nothing
    addCssUrl: function (cssUrl) {
      // TODO: Implement
      console.log("TODO: Implement addCssUrl");
    },
    // Event names that a plugin can listen to
    events: {
      COMPOSE_BOX_LOAD: "compose_box_load",
      SIDE_PANEL_LOAD: "side_panel_load",
      CONTROL_PANEL_LOAD: "control_panel_load",
      //CONVERSATION_LIST_CHANGE: "conversation_list_change",
      CONVERSATION_LIST_ITEM_LOAD: "conversation_list_item_load",
      CONVERSATION_LIST_ITEM_MENU_LOAD: "conversation_list_item_menu_load" // the ellipsis menu

    },
    // A plugin calls this to add an event listener
    addEventListener: function (eventName, callback) {
      console.log("addEventListener. eventName:", eventName);

      switch (eventName) {
        case zw.plugin.events.COMPOSE_BOX_LOAD:
          // Add to our array for callbacks
          console.log("adding COMPOSE_BOX_LOAD callback listener");
          zw.plugin.callbacks[zw.plugin.events.COMPOSE_BOX_LOAD].push(callback);
          break;

        case zw.plugin.events.SIDE_PANEL_LOAD:
          // Add to our array for callbacks
          console.log("adding SIDE_PANEL_LOAD callback listener");
          zw.plugin.callbacks[zw.plugin.events.SIDE_PANEL_LOAD].push(callback);
          break;

        case zw.plugin.events.CONTROL_PANEL_LOAD:
          // Add to our array for callbacks
          console.log("adding CONTROL_PANEL_LOAD callback listener");
          zw.plugin.callbacks[zw.plugin.events.CONTROL_PANEL_LOAD].push(callback);
          break;

        case zw.plugin.events.CONVERSATION_LIST_ITEM_LOAD:
          // Add to our array for callbacks
          console.log("adding CONVERSATION_LIST_ITEM_LOAD callback listener");
          zw.plugin.callbacks[zw.plugin.events.CONVERSATION_LIST_ITEM_LOAD].push(callback);
          break;

        case zw.plugin.events.CONVERSATION_LIST_ITEM_MENU_LOAD:
          // Add to our array for callbacks
          console.log("adding CONVERSATION_LIST_ITEM_MENU_LOAD callback listener");
          zw.plugin.callbacks[zw.plugin.events.CONVERSATION_LIST_ITEM_MENU_LOAD].push(callback);
          break;

        default:
          console.log("You called addEventListener with an event name that does not exist.");
      }
    },
    // Stores the callbacks that are passed in for the events. We call each callback that's in the array
    // for each event when that event occurs
    // Use the enum string val here to make sure name is correct when referencing keys via
    // naming style of zw.plugin.callbacks[zw.plugin.events.CONTROL_PANEL_LOAD]
    callbacks: {
      compose_box_load: [],
      side_panel_load: [],
      control_panel_load: [],
      conversation_list_item_load: [],
      conversation_list_item_menu_load: []
    },
    // Calls all the callbacks for a listener
    // Example: zw.plugin.callEventListeners(zw.plugin.events.CONVERSATION_LIST_ITEM_LOAD, {});
    callEventListeners: function (eventName, evt) {
      console.log("callEventListeners. eventName:", eventName, "evt:", evt);
      var arrayLength = zw.plugin.callbacks[eventName].length;

      for (var i = 0; i < arrayLength; i++) {
        var cb = zw.plugin.callbacks[eventName][i]; //console.log("callEventListeners. cb:", cb);

        cb(evt);
      }
    },
    // Create or Get a Conversation List Item Ellipsis Menu
    getOrCreateConvListItemMenu: function (menuEl, id, menuTxt, tooltip) {
      console.log("getOrCreateConvListItemMenu. menuEl:", menuEl, "id:", id, "menuTxt:", menuTxt, "tooltip:", tooltip); // check to see if this menu item is already in there

      var curEl = menuEl.find('.' + id + '-convlistitem-menu');

      if (curEl.length > 0) {
        console.log("menu item was already there. returning it. curEl:", curEl);
        return curEl;
      }

      var el = $(`<div class="drop-down-menu_menuOption ` + id + `-convlistitem-menu" tabindex="0" testid="` + id + `_CONVLISTMENU_CLICK">
<div data-testid="` + id + `_CONVLISTMENU_TEXT" class="zk-styled-text-base zk-styled-text-primary" title="` + tooltip + `" >` + menuTxt + `</div>
</div>`);
      menuEl.append(el);
      return el;
    },
    // Create or Get a Top Region DIV DOM element for the Compose Box
    // You can call this on an ongoing basis. It will lazy load a panel for you,
    // or if one already exists it will return the DOM element for you.
    // @param id : The id of your plugin. You should have registered it first.
    // @param tooltip : The text shown on hover of top region element.
    // @param iconBaseSvg : A string of the SVG for the base icon that always shows
    getOrCreateComposeBoxTopRegion: function (id, tooltip, iconBaseSvg, iconUrl) {
      console.log("getOrCreateComposeBoxTopRegion. id:", id); // find the plugin area and append

      var pluginEl = $('.plugin-composebox-topregion'); // See if the button already exists for this ID

      var regionEl = pluginEl.find("." + id + "-composebox-topregion"); //console.log("regionEl:", regionEl);

      if (regionEl.length > 0) {
        // the region already exists, just return it
        console.log("region already existed.");
        return regionEl;
      } // the region does not exist. let's create it.


      console.log("region did not exist. creating it.");
      regionEl = $(`
<div class="` + id + `-composebox-topregion plugin-composebox-topregion-item" title="` + tooltip + `">
<div class="iconSvg iconTopRegionSvg">
` + iconBaseSvg + `
</div>
<div class="plugin-composebox-topregion-body">
</div>
<div class="plugin-composebox-topregion-close">
<button style="width:18px;height:18px;" class="zk-button zk-button-transparent xzk-modal-overlay_closeBtn" data-testid="` + id + `-TOPREGION_CLOSE" xtabindex="0" type="button">
<svg viewBox="0 0 24 24" fill="#2b3037" height="18" width="18" class=""><path d="M13.06 12l5.47-5.47a.75.75 0 0 0-1.06-1.06L12 10.94 6.53 5.47a.75.75 0 0 0-1.06 1.06L10.94 12l-5.47 5.47a.75.75 0 0 0 0 1.06.75.75 0 0 0 1.06 0L12 13.06l5.47 5.47a.75.75 0 0 0 1.06 0 .75.75 0 0 0 0-1.06z"></path></svg>
</button>
</div>
</div>
`);
      pluginEl.append(regionEl);
      return regionEl;
    },
    // Create or Get a Top Region DIV DOM element for the Compose Box
    // You can call this on an ongoing basis. It will lazy load a panel for you,
    // or if one already exists it will return the DOM element for you.
    // The CSS version of this method implements the SVG image as a CSS background-image
    // rather than as an inline block of the SVG content.
    // @param id : The id of your plugin, or an extended id if your plugin has multiple top regions
    // @param tooltip : The text shown on hover of top region element.
    // @param iconUrl : A URL of the SVG for the base icon that always shows
    getOrCreateComposeBoxTopRegionCss: function (id, tooltip, iconUrl, startingCss) {
      console.log("getOrCreateComposeBoxTopRegionCss. id:", id); // find the plugin area and append

      var pluginEl = $('.plugin-composebox-topregion'); // See if the button already exists for this ID

      var regionEl = pluginEl.find("." + id + "-composebox-topregion"); //console.log("regionEl:", regionEl);

      if (regionEl.length > 0) {
        // the region already exists, just return it
        console.log("region already existed.");
        return regionEl;
      } // the region does not exist. let's create it.


      console.log("region did not exist. creating it."); // create the CSS

      zw.plugin.addCss("." + id + `-topregion-iconurl {
background-image: url('` + iconUrl + `');
}
`, "top region css");
      regionEl = $(`
<div class="` + id + `-composebox-topregion plugin-composebox-topregion-item ` + startingCss + `" title="` + tooltip + `">
<div class="topregion-iconurl ` + id + `-topregion-iconurl"></div>
<div class="plugin-composebox-topregion-body">
</div>
<div class="plugin-composebox-topregion-close">
<button style="width:18px;height:18px;" class="zk-button zk-button-transparent xzk-modal-overlay_closeBtn" data-testid="` + id + `-TOPREGION_CLOSE" xtabindex="0" type="button">
<svg viewBox="0 0 24 24" fill="#2b3037" height="18" width="18" class=""><path d="M13.06 12l5.47-5.47a.75.75 0 0 0-1.06-1.06L12 10.94 6.53 5.47a.75.75 0 0 0-1.06 1.06L10.94 12l-5.47 5.47a.75.75 0 0 0 0 1.06.75.75 0 0 0 1.06 0L12 13.06l5.47 5.47a.75.75 0 0 0 1.06 0 .75.75 0 0 0 0-1.06z"></path></svg>
</button>
</div>
</div>
`);
      pluginEl.append(regionEl);
      return regionEl;
    },
    // Create or Get a button in the Compose Box Button Bar
    // You can call this on an ongoing basis. It will lazy load a button for you,
    // or if one already exists it will return the DOM element for you.
    // @param id : The id of your plugin button. If multiple buttons, append your plugin id with btn id
    // @param tooltip : The hover text shown to user if they hover their mouse over the icon
    // @param iconUrl : A URL of the SVG for the base icon that always shows
    // @param iconUrlHover : A URL of the SVG shown when mouse is hovering over the button
    // @param iconUrlSel : A URL of the SVG shown after the button is toggled on
    // @param onClickCallback : The function to be called after the user clicks the button
    getOrCreateComposeBoxBtnBarCss: function (id, tooltip, iconUrl, iconUrlHover, iconUrlSel, onClickCallback) {
      console.log("getOrCreateComposeBoxBtnBarCss. id:", id); // find the plugin area and append

      var pluginEl = $('.plugin-composebox-btnbar'); // See if the button already exists for this ID

      var btnEl = pluginEl.find("." + id + "-composebox-btnbar");
      console.log("btnEl:", btnEl);

      if (btnEl.length > 0) {
        // the btn already exists, just return it
        console.log("btn already existed."); //return btnEl;
      } else {
        // the btn does not exist. let's create it.
        console.log("btn did not exist. creating it."); // create the CSS

        zw.plugin.addCss("." + id + `-iconUrl {
background-image: url('` + iconUrl + `');
}
.` + id + `-iconUrl:hover {
background-image: url('` + iconUrlHover + `');
}
.` + id + `-iconUrl:active, .` + id + `-iconUrl.active {
background-image: url('` + iconUrlSel + `');
}
`, "compose box btn bar css"); // create the HTML

        btnEl = $(`
<div class="` + id + `-composebox-btnbar zw-default-div-style send-message-panel_iconContainer">
<div data-testid="` + id + `-COMPOSEBOX-BTN" class="dynamic-attr-picker_icon">
<button class="zk-button zk-button-transparent zk-hover-icon dynamic-attr-picker_buttonStyle" tabindex="0" type="button">
 <div title="` + tooltip + `">
  <div class="iconUrlSvg iconUrlBaseSvg ` + id + `-iconUrl ">
  </div>
 </div>
</button>
</div>
</div>
`);
        pluginEl.append(btnEl); // we need to attach the hover and toggle events

        /*
                btnEl.hover(function(evt) {
                    console.log("got hover in");
                    var myBtnEl = $(evt.currentTarget);
        // if toggle is on, then don't show the hover
                    if (myBtnEl.find('.iconToggleSvg').hasClass("hidden")) {
                        myBtnEl.find('.iconHoverSvg').removeClass("hidden");
                    }
                    myBtnEl.find('.iconBaseSvg').addClass("hidden");
                }, function(evt) {
                    console.log("got hover out");
                    var myBtnEl = $(evt.currentTarget);
        // if toggle is on, then don't show the base
                    if (myBtnEl.find('.iconToggleSvg').hasClass("hidden")) {
                        myBtnEl.find('.iconBaseSvg').removeClass("hidden");
                    }
                    myBtnEl.find('.iconHoverSvg').addClass("hidden");
                });*/

        btnEl.find('.zk-button').click(onClickCallback);
      } // we can return our button now


      return btnEl;
    },
    // Create or Get a button in the Compose Box Button Bar
    // You can call this on an ongoing basis. It will lazy load a button for you,
    // or if one already exists it will return the DOM element for you.
    // @param id : The id of your plugin. You should have registered it first.
    // @param tooltip : The hover text shown to user if they hover their mouse over the icon
    // @param iconBaseSvg : A string of the SVG for the base icon that always shows
    // @param iconHoverSvg : A string of the SVG shown when mouse is hovering over the button
    // @param iconToggleSvg : A string of the SVG shown after the button is toggled on
    // @param onClickCallback : The function to be called after the user clicks the button
    getOrCreateComposeBoxBtnBar: function (id, tooltip, iconBaseSvg, iconHoverSvg, iconToggleSvg, onClickCallback) {
      console.log("getOrCreateComposeBoxBtnBar. id:", id); // find the plugin area and append

      var pluginEl = $('.plugin-composebox-btnbar'); // See if the button already exists for this ID

      var btnEl = pluginEl.find("." + id + "-composebox-btnbar");
      console.log("btnEl:", btnEl);

      if (btnEl.length > 0) {
        // the btn already exists, just return it
        console.log("btn already existed."); //return btnEl;
      } else {
        // the btn does not exist. let's create it.
        console.log("btn did not exist. creating it.");
        btnEl = $(`
<div class="` + id + `-composebox-btnbar zw-default-div-style send-message-panel_iconContainer">
<div data-testid="` + id + `-COMPOSEBOX-BTN" class="dynamic-attr-picker_icon">
<button class="zk-button zk-button-transparent zk-hover-icon dynamic-attr-picker_buttonStyle" tabindex="0" type="button">
<div title="` + tooltip + `">
<div class="iconSvg iconBaseSvg">
` + iconBaseSvg + `
</div>
<div class="iconSvg iconHoverSvg hidden">
` + iconHoverSvg + `
</div>
<div class="iconSvg iconToggleSvg hidden">
` + iconToggleSvg + `
</div>
</div>
</button>
</div>
</div>
`);
        pluginEl.append(btnEl); // we need to attach the hover and toggle events

        btnEl.hover(function (evt) {
          console.log("got hover in");
          var myBtnEl = $(evt.currentTarget); // if toggle is on, then don't show the hover

          if (myBtnEl.find('.iconToggleSvg').hasClass("hidden")) {
            myBtnEl.find('.iconHoverSvg').removeClass("hidden");
          }

          myBtnEl.find('.iconBaseSvg').addClass("hidden");
        }, function (evt) {
          console.log("got hover out");
          var myBtnEl = $(evt.currentTarget); // if toggle is on, then don't show the base

          if (myBtnEl.find('.iconToggleSvg').hasClass("hidden")) {
            myBtnEl.find('.iconBaseSvg').removeClass("hidden");
          }

          myBtnEl.find('.iconHoverSvg').addClass("hidden");
        });
        btnEl.find('.zk-button').click(onClickCallback);
      } // we can return our button now


      return btnEl;
    }
  },
  // The Shim code is an area where we are writing Javascript that likely is not needed in the final product
  // when core engineering can do stuff natively in the React codebase to achieve what we had to do with duct-tape
  // like workarounds.
  shim: {
    onLoad: function () {
      console.log("shim onLoad"); // When we get this as a first class citizen, we should not need this code. So trying to keep
      // weird workarounds in here. This method should get called at load of page to start any code
      // in here that does watching of the DOM, for instance.
      // Watch DOM to see if conv selection changes. If so trigger events. Eventually a real implementation
      // of the plugin infrastructure would call the COMPOSE_BOX_LOAD events from React
      //this.startWatchingForConversationSelectChange();
      // Also watch DOM to see if the conversation list changes, so we can fire off an event, to let
      // a plugin do stuff like add a tag to the coversation list item, or bind a hover event to the contact name,
      // or add some other element to the conv list item

      this.startWatchingForConversationChange(); // Older approach of setInterval() that we are using to detect if you click on
      // a diff conversation. We should refactor to be part of the Mutation Observer approach
      // used in startWatchingForConversationChange()
      //this.startWatchingForConversationSelectChange();
      // add a hidden class so we can easily hide DOM elements, when without react, we need to do via css
      // other classes here we expect core zipwhip app to provide once it treats plugins as a 1st class citizen

      zw.plugin.addCss(`
.hidden { display:none !important; }
.plugin-composebox-btnbar {
-webkit-box-orient: horizontal;
-webkit-box-direction: normal;
-ms-flex-direction: row;
flex-direction: row;
display: flex;
}
.plugin-composebox-topregion {
white-space: normal;
}
.plugin-composebox-topregion-item {
border:1px solid #d2d7de;
border-bottom: 0px;
background-color: #eeeff2;
border-radius:2px;
padding:6px 4px 6px 12px;
margin:0px;
-webkit-box-orient: horizontal;
-webkit-box-direction: normal;
-ms-flex-direction: row;
flex-direction: row;
display: flex;
}
.plugin-composebox-topregion-body {
flex-grow: 1;
}
.plugin-composebox-topregion-close {
margin-left: 4px;
}
.iconTopRegionSvg {
margin-right:8px;
width: 18px;
height: 18px;
}
.iconUrlSvg {
width: 24px;
height: 24px;
background-size: 24px 24px;
margin-top:-3px;
}
.topregion-iconurl {
width: 18px;
height: 18px;
background-size: 18px 18px;
opacity: 0.5;
margin-right: 8px;
}
`, "global plugin css");
    },
    // Looks thru the DOM for the Contact Info panel and grabs the phone number
    // Done - TODO: Watch for if they don't ahve the Info panel open, as this will fail
    // Done - TODO 2: If it's a group, we'll get something whacky and definitely not a phone number
    // Long term we should not need this as it should just be given in the events
    // Return obj with phone string that is a primary key including for groups, isGroup flag, and phone array if it is a group
    getContactPhone: function () {
      //console.log("getContactPhone");
      var el = $('.single-contact-panel_singleContactPanelContainer'); //console.log("parent contact card", el);

      if (el.length == 0) {
        //console.log("could not find an open conversation");
        // before we give up here, check if there's a group and return "group"
        // because this means there is a conversation, just not one specific to a contact
        var groupEl = $('.group-contacts-panel_groupContactPanelContainer');

        if (groupEl.length > 0) {
          // get all the phone numbers
          var allNumEls = groupEl.find('.zk-styled-text-small.zk-styled-text-primary.zk-styled-text-secondary'); //console.log("allNumEls:", allNumEls, allNumEls.text());

          var arr = [];

          for (var i = 0; i < allNumEls.length; i++) {
            var item = $(allNumEls[i]); //console.log("item:", item);

            if (item.text()) arr.push(item.text());
          }

          return {
            isGroup: true,
            phone: "group:" + arr.join(","),
            phones: arr
          }; //"group:" + arr.join(",");
        }

        return null;
      }

      var phoneEl = el.find('.zk-styled-text-small.zk-styled-text-primary.zk-styled-text-secondary'); //console.log("phone el:", phoneEl);

      if (phoneEl.length > 0) {
        //console.log("found convo");
        var contactPhone = phoneEl.text(); //console.log("contact phone:", contactPhone);

        return {
          phone: contactPhone,
          isGroup: false
        };
      } else {
        //console.log("could not find phone number for current contact");
        return null;
      }
    },
    // Get the ContactId from a phone number by calling Zipwhip API via ajax
    getContactIdFromContactPhone: function (phone, callback) {
      console.log("getContactIdFromContactPhone. phone:", phone);
      phone = phone.replace(/\D/g, ""); // swap non-digits for emptiness to get clean phone number. don't u love regular expressions!

      console.log("cleaned up phone number", phone);
      var url = "https://app.zipwhip.com/api/v1/conversation/get?address=ptn%3A%2F%2B1" + phone + "&limit=1&start=0";
      var headersObj = {
        authorization: zw.getSessionKey()
      };
      console.log("url to query for contactid:", url, "headers:", headersObj); // do ajax query and get results. based on the results i'll render stuff.

      $.ajax({
        type: "GET",
        url: url,
        headers: headersObj,
        success: function (data) {
          console.log("got success from ajax call for getContactIdFromContactPhone. data:", data); // now go deep into the object

          /* response: {messages: [,…],…}
          conversation: {id: 396472207207, version: 18, deviceId: 366608407, lastUpdated: "2019-12-13T20:26:26+00:00",…}
          address: "ptn:/+15035752613"
          bcc: null
          cc: null
          class: "com.zipwhip.website.data.dto.Conversation"
          contacts: [{id: 31324856907, version: 1, lastUpdated: "2019-12-13T04:51:56+00:00",…}]
          0: {id: 31324856907, version: 1, lastUpdated: "2019-12-13T04:51:56+00:00",…}
          id: 31324856907
          */

          if ('response' in data) {
            console.log("found response in data", data.response);

            if ('conversation' in data.response && 'contacts' in data.response.conversation && data.response.conversation.contacts.length > 0) {
              var contacts = data.response.conversation.contacts;
              console.log("we have a contacts array in the conversation. good.", contacts);

              if (contacts.length == 1) {
                var contactId = contacts[0].id;
                console.log("got contactId:", contactId); // finally do callback

                if (callback) callback(data.response.conversation, contactId, contacts[0]);
              } else {
                console.error("got back more than one contact id, so treating as error.");
              }
            }
          }
        },
        error: function (err) {
          console.log("got error on ajax. err:", err);
        },
        failure: function (err) {
          console.log("got failure on ajax. err:", err);
        }
      });
    },
    getContactIdFromName: function (name, retItemEl, callback) {
      console.log("getContactIdFromName. name:", name); // https://app.zipwhip.com/api/search/contact-list?filter=NAME_MOBILE&from=0&query=John%20Lauer%20Mobile&size=20

      var url = "https://app.zipwhip.com/api/search/contact-list?filter=NAME_MOBILE&from=0&query=" + encodeURIComponent(name) + "&size=1";
      var headersObj = {
        authorization: zw.getSessionKey()
      };
      console.log("url to query for contactid from name:", url, "headers:", headersObj); // do ajax query and get results. based on the results i'll render stuff.

      $.ajax({
        type: "GET",
        url: url,
        headers: headersObj,
        success: function (data) {
          //console.log("got success from ajax call for getContactIdFromName. data:", data);
          // now go deep into the object

          /*
          {success: true,…}
          response: {results: {contact: [{id: 11289716707, lastUpdated: "2020-04-15T01:10:33.000+0000",…}]}, total: 1,…}
          from: 0
          results: {contact: [{id: 11289716707, lastUpdated: "2020-04-15T01:10:33.000+0000",…}]}
          contact: [{id: 11289716707, lastUpdated: "2020-04-15T01:10:33.000+0000",…}]
          0: {id: 11289716707, lastUpdated: "2020-04-15T01:10:33.000+0000",…}
          address: "ptn:/+13134147502"
          addressLine1: ""
          addressLine2: ""
          birthday: null
          blocked: false
          businessName: ""
          carrier: "Vzw"
          city: ""
          country: ""
          custom1: ""
          custom2: ""
          dateCreated: "2018-04-30T15:19:49.000+0000"
          deleted: false
          deviceId: 366608407
          email: ""
          firstName: "John"
          fullName: "John Lauer Mobile"
          hidden: 0
          id: 11289716707
          isZwUser: false
          jobTitle: ""
          lastName: "Lauer Mobile"
          lastUpdated: "2020-04-15T01:10:33.000+0000"
          latlong: ""
          loc: ""
          matchFields: ["nameMetaData"]
          mobileNumber: "+13134147502"
          notes: ""
          optOut: false
          state: ""
          zipcode: ""
          size: 20
          total: 1
          success: true
          */
          if ('response' in data) {
            //console.log("found response in data", data.response);
            if ('results' in data.response && 'contact' in data.response.results && data.response.results.contact.length > 0) {
              var contacts = data.response.results.contact; //console.log("we have a contacts array in the respone. good.", contacts);

              if (contacts.length == 1) {
                var contactId = contacts[0].id;
                var phoneNum = contacts[0].mobileNumber; //console.log("got contactId:", contactId, "phoneNum:", phoneNum);
                // finally do callback

                if (callback) callback(retItemEl, contactId, phoneNum, contacts[0], contacts);
              } else {
                console.error("got back more than one contact id, so treating as error.");
              }
            }
          }
        },
        error: function (err) {
          console.log("got error on ajax. err:", err);
        },
        failure: function (err) {
          console.log("got failure on ajax. err:", err);
        }
      });
    },
    // keeps track of last contact phone number we saw, to know if we have a new contact
    lastContactPhone: null,
    // keep track of last selected conversation
    lastConvSelPhone: null,
    // Loop every 500ms to see if the user selected a diff conversation by watching CSS tags
    // Highly inefficient. Can't wait for core engineering to give us a native event.
    OldstartWatchingForConversationSelectChange: function () {
      console.log("startWatchingForConversationChange"); // we are going to just watch for a selected conversation
      // we can do this by watching the DOM for this CSS selector
      //   .conversation-list-panel_hover.conversation-list-panel_selected
      // if we find nothing, we can set our selected conversation back to null
      // if we find something selected, we check if it's different than last convo

      var that = this;
      var intervalId = setInterval(function () {
        // check if we have .conversation-list-panel_hover.conversation-list-panel_selected
        var convSelEl = $('.conversation-list-panel_hover.conversation-list-panel_selected');

        if (convSelEl.length > 0) {
          // we found a selected element.
          //console.log("found selected conversation. convSelEl:", convSelEl);
          // we need to get the phone number of this convo to determine if we've changed convos
          var newPhoneObj = zw.shim.getContactPhone();

          if (newPhoneObj.phone != zw.shim.lastConvSelPhone) {
            //console.log("newPhone did not equal lastConvSelPhone. new convo! old:", zw.shim.lastConvSelPhone, "new:", newPhone);
            var oldPhone = zw.shim.lastConvSelPhone;
            zw.shim.lastConvSelPhone = newPhoneObj.phone;
            that.onNewConversationSelected(newPhoneObj, oldPhone);
          } else {// this is the same convo. we can punt.
            //console.log("selected conversation didn't change. ignoring...");
          }
        } else {
          // we found nothing, set lastContactPhone to null
          //console.log("setting last selected conversation to null");
          zw.shim.lastConvSelPhone = null;
        }
      }, 500);
    },
    // We call this method after we've determined a new conversation has been selected
    onNewConversationSelected: function (newPhoneObj, oldPhone) {
      var newPhone = newPhoneObj.phone;
      console.log("onNewConversationSelected. newPhone:", newPhone, "oldPhone:", oldPhone); // we can get a group here, so in that case there's no contactId to look up.

      if (newPhoneObj.isGroup) {
        newPhone = newPhoneObj.phones[0]; // just take 1st array item
      } // Now let's look up the ContactId asynchronously, and when we get it back call the load events


      zw.shim.getContactIdFromContactPhone(newPhone, function (conversation, contactId, contact) {
        // Now that we have a ContactId let's call the load events
        console.log("ok we got back from our ajax call and have a new contactid"); // Before we call the event listeners for load events, let's create our Plugin regions.
        // These would be created by default by React once this is a 1st class citizen, but for now
        // let's sort of lazy load ensure that our plugin region divs are created
        // Create Compose Box Button Bar plugin region, if not created

        var composeBoxBtnBarPluginEl = $('.send-message-panel_row .plugin-composebox-btnbar');

        if (composeBoxBtnBarPluginEl.length > 0) {
          // it's already there. leave alone.
          console.log(".plugin-composebox-btnbar was already there. leaving alone."); // actually, delete it all, so we start fresh

          composeBoxBtnBarPluginEl.remove();
        } //} else {
        // it's not there. create it.


        console.log(".plugin-composebox-btnbar was NOT there. creating...");
        var rowEl = $('.send-message-panel_row');
        composeBoxBtnBarPluginEl = $('<div class="plugin-composebox-btnbar"></div>');
        rowEl.append(composeBoxBtnBarPluginEl); //}
        // Make sure the signature toggle icon has class name of send-message-panel_iconContainer
        // so that it adds padding-right like all the other buttons

        var sigBtnEl = composeBoxBtnBarPluginEl.parent().find('.signature-toggle_image');
        sigBtnEl.css("margin-right", "10px"); // Create Compose Box Top Region plugin region, if not created

        var composeTopRegionPluginEl = $('.plugin-composebox-topregion');

        if (composeTopRegionPluginEl.length > 0) {
          // it's already there. leave alone.
          console.log(".plugin-composebox-topregion was already there. leaving alone."); // actually, delete it all, so we start fresh

          composeTopRegionPluginEl.remove();
        } //} else {
        // it's not there. create it.


        console.log(".plugin-composebox-topregion was NOT there. creating..."); // let's show a region above the compose box

        var mainEl = $('.zw-default-div-style.compose-box-new');
        var divEl = $('<div class="plugin-composebox-topregion zk-styled-text-base"></div>'); //divEl.click(this.onTopRegionClick.bind(this));

        this.composeBoxTopRegionEl = divEl;
        mainEl.parent().prepend(divEl);
        console.log("prepended compose top region"); //}
        // We should wipe everything attached to the textarea, but for now
        // let's leave it alone cuz i don't know if i'd be deleting react stuff
        // Call Compose Box Load event

        var composeTextAreaEl = $(".zk-text-editor_input.zk-text-editor_content.compose-box_textInput");
        zw.plugin.callEventListeners(zw.plugin.events.COMPOSE_BOX_LOAD, {
          composeTextAreaEl: composeTextAreaEl,
          composeBoxBtnBarPluginEl: composeBoxBtnBarPluginEl,
          composeTopRegionPluginEl: composeTopRegionPluginEl,
          phoneObj: newPhoneObj,
          phone: newPhone,
          oldPhone: oldPhone,
          conversation: conversation,
          contactId: contactId,
          contact: contact
        }); // Call Side Panel Load event

        zw.plugin.callEventListeners(zw.plugin.events.SIDE_PANEL_LOAD, null);
      });
    },
    // Use a setInterval to loop every n milliseconds to see when our page has loaded
    // and React created the core layout
    startWatchingForConversationChange: function () {
      console.log("startWatchingForConversationChange"); // we have to wait around for the DOM to get loaded by React, so just loop
      // until we find the DOM element we're after

      var that = this;
      var intervalId = setInterval(function () {
        //var el = $('#root');
        var el = $('.conversation-list-panel_container');

        if (el.length > 0) {
          // we found it.
          //console.log("finally found the root panel. el:", el);
          console.log("finally found the conversation panel. el:", el); // clear myself so i stop looping

          clearInterval(intervalId); // now continue on with watching the conversation change

          that.startWatchingForConversationChangeStepTwo();
        } else {// do nothing
          //console.log("continuing to wait for DOM conversation panel to load...");
        }
      }, 200);
    },
    // This continues our process of watching for conversation changes once we have our DOM element
    // of the conversation panel
    startWatchingForConversationChangeStepTwo: function () {
      // Use the amazing DOM event of DOMSubtreeModified to see if anything changes
      // And if it does, check to see if it's a new conversation. If it's new, do lots of stuff
      // this watches the right side info panel, which is fleeting. i think it gets deleted so lose bind()
      //$('.single-contact-panel_singleContactPanelContainer').bind('DOMSubtreeModified', function(e) {
      // watch the left side conversation panel, which does not get destroyed, so bind stays intact
      // old: .conversation-list-panel_listContainer
      // old: .conversation-list-panel_container
      // old: .single-contact-panel_singleContactPanelContainer
      // conversation-list-panel_container
      // #root
      var el = $('#root'); //var el = $('.conversation-list-panel_container');

      console.log("got el to attach watch event. el:", el); // we need to debounce all of these callbacks. so the trick is to do a setTimeout but to wipe
      // the timeout on each callback so that we get the actual load pretty much only once. even if we don't
      // get it once, that's safe, it's just that we don't want to call all our phone retrieval events a million time

      var timeoutId = null; // Select the node that will be observed for mutations

      const targetNode = el[0]; // Options for the observer (which mutations to observe)

      const config = {
        attributes: false,
        childList: true,
        subtree: true,
        characterData: false
      }; // Just use callback as trigger to re-look at DOM, just debounce so don't overdo it
      // Callback function to execute when mutations are observed

      const callback = function (mutationsList, observer) {
        // do debounce
        if (timeoutId != null) {
          // we have a timeout already. cancel it.
          clearTimeout(timeoutId);
        } // now create setTimeout


        timeoutId = setTimeout(zw.shim.onWatchingForConversationChange, 500);
      }; // Create an observer instance linked to the callback function


      const observer = new MutationObserver(callback); // Start observing the target node for configured mutations

      observer.observe(targetNode, config);
    },
    // This is called after our DOM change event thinks we had a change, but it's called
    // after a nice debounce so we are efficient
    onWatchingForConversationChange: function () {
      console.log("onWatchingForConversationChange. that means debounce is done."); // Let's scan all conversation items, see if they are new, and if so trigger an event
      // Leave a tag per item in the DOM so we know we've thrown an event for it

      var convItemEls = $('.conversation-list-panel_hover');

      for (var item of convItemEls) {
        //console.log("item:", item);
        let itemEl = $(item); // see if already have tag that we threw event

        if (itemEl.attr('data-contactid')) {// already fired new event for this conv item, so can ignore
          //console.log("already handled conv item data-contactid:", itemEl.attr('data-contactid'));
        } else {
          // throw new event
          //console.log("throwing new event for conv item. itemEl:", itemEl);
          // get the name, so that we can lookup the contactId
          var nameEl = itemEl.find(".conversation-card-container_nameContainer > .conversation-card-container_nameContainer");
          var nameTxt = nameEl.text(); //console.log("nameEl:", nameEl);

          zw.shim.getContactIdFromName(nameTxt, itemEl, function (retItemEl, contactId, phoneNum, contact, contacts) {
            //console.log("got callback from getContactIdFromName. contactId:", contactId, phoneNum, contacts);
            retItemEl.attr('data-contactid', contactId);
            retItemEl.attr('data-phone', phoneNum); //console.log("attached data items to retItemEl:", retItemEl);
            // now throw event

            var evt = {
              itemEl: retItemEl,
              contactId: contactId,
              phoneNum: phoneNum,
              contact: contact,
              contacts: contacts
            };
            zw.plugin.callEventListeners(zw.plugin.events.CONVERSATION_LIST_ITEM_LOAD, evt);
          });
        }
      } // let's secondarily see if a menu was shown, and if so throw off an event


      var convItemMenuEls = $('.drop-down-menu_menu.conversation-list-panel_moreMenu');

      if (convItemMenuEls.length > 0) {
        console.log("convItemMenuEl:", convItemMenuEls);
        var convItemMenuEl = $(convItemMenuEls[0]); // let's make sure we haven't thrown an event for this yet. that can happen
        // if a change is made to the DOM by a plugin on this menu

        if (convItemMenuEl.attr('data-iseventthrown') == "yes") {
          console.log("load evt already thrown for this menu. ignoring...");
        } else {
          convItemMenuEl.attr('data-iseventthrown', "yes");
          let itemEl = convItemMenuEl.parent('.conversation-list-panel_hover');
          var contactId = itemEl.attr('data-contactid');
          var phoneNum = itemEl.attr('data-phone'); // now throw event

          var evt = {
            itemEl: itemEl,
            itemMenuEl: convItemMenuEl,
            contactId: contactId,
            phoneNum: phoneNum
          };
          zw.plugin.callEventListeners(zw.plugin.events.CONVERSATION_LIST_ITEM_MENU_LOAD, evt);
        }
      } // 3rd, let's see if any conversation got selected
      // check if we have .conversation-list-panel_hover.conversation-list-panel_selected


      var convSelEl = $('.conversation-list-panel_hover.conversation-list-panel_selected');

      if (convSelEl.length > 0) {
        // we found a selected element.
        //console.log("found selected conversation. convSelEl:", convSelEl);
        // we need to get the phone number of this convo to determine if we've changed convos
        var newPhoneObj = zw.shim.getContactPhone();

        if (newPhoneObj.phone != zw.shim.lastConvSelPhone) {
          //console.log("newPhone did not equal lastConvSelPhone. new convo! old:", zw.shim.lastConvSelPhone, "new:", newPhone);
          var oldPhone = zw.shim.lastConvSelPhone;
          zw.shim.lastConvSelPhone = newPhoneObj.phone;
          zw.shim.onNewConversationSelected(newPhoneObj, oldPhone);
        } else {// this is the same convo. we can punt.
          //console.log("selected conversation didn't change. ignoring...");
        }
      } else {
        // we found nothing, set lastContactPhone to null
        //console.log("setting last selected conversation to null");
        zw.shim.lastConvSelPhone = null;
      }
    }
  }
}; // store as global

window["zw"] = zw;
console.log("Plugin - Boot.js ran"); // Now check the app store for which plugins this user has installed
// Download the jsUrl for each plugin and run its onLoad method

console.log("Plugin - Now checking app store for installed plugins for this user..."); // Load all of the plugins 

function loadAllPlugins(plugins) {
  zw.shim.onLoad();
  console.log("Loading Plugin scripts"); // Manual override of bot list

  /*
  plugins = [{
    urls: {
      jsUrl: "http://localhost:8080/ZwHumanDate/plugin.js",
    },
    metadata: {
      name: "Human Date Time",
    }
    }]
  */

  plugins.forEach(function (plugin) {
    console.log(plugin);

    if (plugin && plugin.urls && plugin.urls.jsUrl) {
      /* // Approach for pastebin
      var script = document.createElement('script');
      // script.text = "//" + bot.urls.js_url + "\n\n" + data;
      script.setAttribute('src', bot.urls.js_url);
      script.setAttribute('type', 'text/javascript');
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("Plugin Loaded - ", bot.metadata.name);
      */
      // cache buster
      let ts = new Date().getTime();
      let url = "";
      url = "https://i2dcui.appspot.com/slingshot?url=";
      url += plugin.urls.jsUrl; // url += "?ts=" + ts;

      console.log("Plugin - Url being retrieved:", url); // ajax retrieve the document

      $.ajax({
        type: "GET",
        url: url,
        success: function (data) {
          if (data) {
            // Put the script inline in a script tag in the DOM to avoid
            // any caching issues and to avoid meta-type issues
            var script = document.createElement('script');
            script.text = "//" + plugin.urls.jsUrl + "\n\n" + data; //script.setAttribute('src', bot.urls.jsUrl);
            //script.setAttribute('type', 'text/javascript');

            document.getElementsByTagName('head')[0].appendChild(script);
            console.log("Plugin Loaded - ", plugin.metadata.name);
          }
        },
        error: function (err) {
          console.log("got error on ajax. err:", err);
        }
      });
    }
  });
} // Check for existence of jquery
// setInterval() watch for $ not being null


var interval = setInterval(function () {
  console.log("Loop", typeof $);

  if ($) {
    clearInterval(interval); //loadAllPlugins();

    $.ajax({
      type: "GET",
      url: "https://plugins.zw.wagar.cc/line/" + zw.getLine(),
      success: function (data) {
        console.log("data:", data);

        if (data && 'plugins' in data) {
          loadAllPlugins(data.plugins);
        }
      },
      error: function (err) {
        console.log("got error on ajax. err:", err);
      }
    });
  }
}, 500);
/*
function loadAllPlugins(plugins) {
  zw.shim.onLoad();
  console.log("Loading Plugin scripts");
  plugins.forEach(plugin => {
    console.log(plugin);
    if (plugin && plugin.urls && plugin.urls.jsUrl) {
      var script = document.createElement('script');
      script.setAttribute('src', plugin.urls.jsUrl);
      script.setAttribute('type', 'text/javascript');
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("Plugin Loaded - ", plugin.metadata.name);
    }
  })
}
*/