/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const global = this;
const BUTTON_ID = "about-addons-memory-btn"; //Button ID for widget
var {CustomizableUI} = Components.utils.import("resource:///modules/CustomizableUI.jsm", {});
var {Services} = Components.utils.import("resource://gre/modules/Services.jsm", {});

var sss = null;
var styleSheetUri = null;

function install() {}
function uninstall() {}

function ReuseFeaturesTab(attrName, url) {
	try{		
			var tabbrowser = Services.wm.getEnumerator("navigator:browser").getNext().gBrowser;
		
			for (var found = false, index = 0; index < tabbrowser.tabContainer.childNodes.length && !found; index++) {

				// Get the next tab
				var currentTab = tabbrowser.tabContainer.childNodes[index];
			  
				// Does this tab contain our custom attribute or name?
				//Incase of browser restart use currentTab.label to identify our tab.
				if (currentTab.hasAttribute(attrName) || currentTab.label == url) {
					
				// Yes--select and focus it.
				tabbrowser.selectedTab = currentTab;

				// Focus *this* browser window in case another one is currently focused
				tabbrowser.ownerDocument.defaultView.focus();
				found = true;
			}
		}

		if (!found) {
			// Our tab isn't open. Open it now.
			  
			// Create tab
			var newTab = tabbrowser.addTab(url);
			newTab.setAttribute(attrName, "aboutaddonsmemory");
			  
			// Focus tab
			tabbrowser.selectedTab = newTab;
				
			// Focus *this* browser window in case another one is currently focused
			tabbrowser.ownerDocument.defaultView.focus();
		}			  
	}catch (e){}
}

var CUIWidgetListener = {
		//Set icon type when widget added to area, Backedup with styleSheet.
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
		//Remove WidgetListener when widget destroyed
        onWidgetDestroyed: function(aWidgetId) {
            if (aWidgetId != BUTTON_ID ) {
                return;
            }
            CustomizableUI.removeListener(CUIWidgetListener);
        }
};

var initStyle = {
	//Load styleSheet
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
	//Unload styleSheet
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
	//Add CustomizableUI widget listener
    CustomizableUI.addListener(CUIWidgetListener);
    CustomizableUI.createWidget({
        id: BUTTON_ID ,
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: 'about:addons-memory',
        tooltiptext: 'This button will open about:addons-memory in a browser tab.', //Potential to be localized
		onCommand: function(aEvent) {
			ReuseFeaturesTab("aboutaddonsmemory", "about:addons-memory"); //Prevents multiple about:addons-memory tabs
		}
    });
	
  	//Load styleSheet
	initStyle.init();
	
	//Will unload itself
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
  //Destroy toolbar button on shutdown
  CustomizableUI.destroyWidget(BUTTON_ID);
  //Unload styleSheet
  initStyle.uninit();
  unload("shutdown");
}

/* vim: set et ts=2 sw=2 : */
