chrome.commands.onCommand.addListener(function(command) {
  console.log('Command:', command);
  switch (command) {
    case 'toggle-play-pause':
      togglePlayPause();
      break;
    case 'toggle-pip':
      togglePip();
      break;
    case 'backward':
      backward();
      break;
    case 'fast-forward':
      fastForward();
      break;
    case 'increase-speed':
      increasePlaybackRate();
      break;
    case 'decrease-speed':
      decreasePlaybackRate();
      break;
    case 'next':
      nextSong();
      break;
    case 'prev':
      prevSong();
      break;
  }
});

/**
 * If there's a PiP video, try to play/pause that video
 * Else,
 *  Find current audible tab => toggle that video.
 *  Else,
 *    Find current active tab => toggle that video
 *  
 */
function togglePlayPause() {
  getProperTab()
    .then(async tab => {
      await executeScript(tab.id, {file: "toggle_play_pause_video.js", allFrames: true});
    });
}
/**
 * Logic to enable pip:
 * - Current focused tab
 * - First playing youtube tab
 */
function togglePip() {
  getCurrentPipTab()
    .then(async result => {
      const tabs = result.allTabs;
      if (result.pipTab) {
        await executeScript(result.pipTab.id, {code: "document.exitPictureInPicture()"});
        return;
      }
      const activeTabs = tabs.filter(tab => tab.active == true);
      if (activeTabs.length > 0) {
        await enablePip(activeTabs[0].id);
        return;
      } 
      const audibleTabs = tabs.filter(tab => tab.audible == true);
      if (audibleTabs.length > 0) {
        await enablePip(audibleTabs[0].id);
      }
    });
}

//https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
function increasePlaybackRate() {
  getCurrentPipTab()
  .then(async result => {
    console.log("Increase playback rate", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.pipTab.id, {file: "increase_speed.js", allFrames: true});
      console.log("Try to increase speed PiP", scriptResult);
      return;
    }
  });
}

function decreasePlaybackRate() {
  getCurrentPipTab()
  .then(async result => {
    console.log("Decrease playback rate", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.pipTab.id, {file: "decrease_speed.js", allFrames: true});
      console.log("Try to decrease speed PiP", scriptResult);
      return;
    }
  });
}

function fastForward() {
  getCurrentPipTab()
    .then(async result => {
      console.log("FF", result);
      if (result.pipTab) {
        const scriptResult = await executeScript(result.pipTab.id, {file: "fast_forward.js", allFrames: true});
        console.log("Try to fast forward PiP", scriptResult);
        return;
      }
    });
}

function backward() {
  getCurrentPipTab()
  .then(async result => {
    console.log("BW", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.pipTab.id, {file: "backward.js", allFrames: true});
      console.log("Try to backward PiP", scriptResult);
      return;
    }
  });
}
/**
 * - Use current PiP
 * - Use current audible tab
 * - Use current active tab
 */
function nextSong() {
  getProperTab()
    .then(async tab => {
      console.log("Next song", tab);
      await executeScript(tab.id, {file: "next_song.js", allFrames: true});
    });
}

function prevSong() {
  getProperTab()
  .then(async tab => {
    console.log("Prev song", tab);
    await executeScript(tab.id, {file: "prev_song.js", allFrames: true});
  });
}

function getCurrentPipTab() {
  return new Promise(function(resolve, reject) {
    queryTabs({url: "https://*.youtube.com/*"})
    .then(async tabs => {
      const checkPromises = tabs.map(async tab => {
        const result = await executeScript(tab.id, {code: "document.pictureInPictureElement", allFrames: true});
        return {tab: tab, ele: result};
      });

      for (const checkPromise of checkPromises) {
        const executeResult = await checkPromise;
        if (executeResult.ele) {  
          resolve({
            allTabs: tabs,
            pipTab: executeResult.tab
          });
          return;
        }
      }
      resolve({
        allTabs: tabs,
        pipTab: null
      });
    });
  });
}

/**
 * Get tab by order
 * - Get current PiP tab
 * - Get Audible tab
 * - Get Active tab
 */
function getProperTab() {
  return getCurrentPipTab()
    .then(async result => {
      const tabs = result.allTabs;
      if (result.pipTab) {
        return Promise.resolve(result.pipTab);
      }
      const audibleTabs = tabs.filter(tab => tab.audible == true);
      if (audibleTabs.length > 0) {
        return Promise.resolve(audibleTabs[0]);
      }
      const activeTabs = tabs.filter(tab => tab.active == true);
      if (activeTabs.length > 0) {
        return Promise.resolve(activeTabs[0]);
      }
      return Promise.reject("No tab is found");
    });
}

function enablePip(tabId) {
  executeScript(tabId, { file: 'active_pip.js', allFrames: true });
}

function queryTabs(details) {
  return new Promise(function(resolve, reject) {
    chrome.tabs.query(details, tabs => {
      console.log("Tabs", tabs);
      resolve(tabs);
    });
  });
}

function executeScript(tabId, option) {
  return new Promise(function(resolve, reject) {
    chrome.tabs.executeScript(tabId, option, result => {
      console.log("Execute script for tab %d",tabId, option, result);
      if (result && result[0]) {
        resolve(result);
      } else {
        resolve(null);
      }
    });
  });
}