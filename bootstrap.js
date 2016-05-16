/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const global = this;
const BUTTON_ID = "about-addons-memory-btn";
var {CustomizableUI} = Components.utils.import("resource:///modules/CustomizableUI.jsm", {});
var {Services} = Components.utils.import("resource://gre/modules/Services.jsm", {});

var sss = null;
var styleSheetUri = null;

function install() {}
function uninstall() {}

var CUIWidgetListener = {
        onWidgetAdded: function(aWidgetId, aArea, aPosition) {
            if (aWidgetId != BUTTON_ID ) {
                return
            }
           
            var useIcon;
            if (aArea == CustomizableUI.AREA_PANEL) {
                useIcon = 'chrome://about-addons-memory/content/icon32.png';
            } else if (aArea == CustomizableUI.TYPE_TOOLBAR) {
                useIcon = 'chrome://about-addons-memory/content/icon16.png';
            } else {
				useIcon = 'chrome://about-addons-memory/content/icon16.png';
			}
            
            var myInstances = CustomizableUI.getWidget(BUTTON_ID).instances;
            for (var i=0; i<myInstances.length; i++) {
                myInstances[i].node.setAttribute('image', useIcon);
            }

        },
        onWidgetDestroyed: function(aWidgetId) {
            if (aWidgetId != BUTTON_ID ) {
                return;
            }
            CustomizableUI.removeListener(CUIWidgetListener);
        }
};

var initStyle = {
	init : function() {
		try {
			 sss = Components.classes["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);
			 styleSheetUri = Services.io.newURI('chrome://about-addons-memory/content/toolbar-button.css', null, null);

			// Register global so it works in all windows, including palette
			if ( !sss.sheetRegistered(styleSheetUri, sss.AUTHOR_SHEET) ) {
				sss.loadAndRegisterSheet(styleSheetUri, sss.AUTHOR_SHEET);
			}
		}catch(e){}
	},
	uninit : function() {
		try {
			if ( sss === null ) {
				return;
			}
			if ( sss.sheetRegistered(styleSheetUri, sss.AUTHOR_SHEET) ) {
				sss.unregisterSheet(styleSheetUri, sss.AUTHOR_SHEET);
			}
			sss = null;
			styleSheetUri = null;
		}catch(e){}
	}
};

function startup(data) {
	//Add CustomizableUI wiget listener
    CustomizableUI.addListener(CUIWidgetListener);
    CustomizableUI.createWidget({
        id: BUTTON_ID ,
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: 'about:addons-memory',
        tooltiptext: 'This button will open about:addons-memory in a browser tab.',
		onCommand: function(aEvent) {
			var aDOMWindow = Services.wm.getMostRecentWindow('navigator:browser');
			aDOMWindow.gBrowser.selectedTab = aDOMWindow.openUILinkIn("about:addons-memory", 'tab', {relatedToCurrent:true});
		}
    });
	initStyle.init();
	// will unload itself
	Components.utils.import("chrome://about-addons-memory/content/loader.jsm");
	_setupLoader(data, function real_startup() {
	try {
		require("main");
	}catch (ex) {
		Components.utils.reportError(ex);
	}
	});
}

function shutdown(reason) {
  if (reason === APP_SHUTDOWN) {
    // No need to cleanup; stuff will vanish anyway
    return;
  }
  CustomizableUI.destroyWidget(BUTTON_ID);
  initStyle.uninit();
  unload("shutdown");
}

/* vim: set et ts=2 sw=2 : */
