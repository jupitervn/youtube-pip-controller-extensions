function YTBFrame(frameId, tab) {
  this.frameId = frameId;
  this.tab = tab;
}
function isYoutubeTab(tab) {
  return tab.url.includes("youtube.com");
}

const NO_PROPER_FRAME_FOUND = "NO_PROPER_FRAME";
const NO_ACTIVE_PIP_FRAME = "NO_ACTIVE_PIP";
const NO_PLAYING_YTB_FRAME = "NO_PLAYING_YTB_FRAME";

chrome.commands.onCommand.addListener(async function(command) {
  console.log('Command:', command);
  switch (command) {
    case 'toggle-play-pause':
      await togglePlayPause();
      break;
    case 'toggle-pip':
      await togglePip();
      break;
    case 'backward':
      await backward();
      break;
    case 'fast-forward':
      await fastForward();
      break;
    case 'increase-speed':
      await increasePlaybackRate();
      break;
    case 'decrease-speed':
      await decreasePlaybackRate();
      break;
    case 'next':
      await nextSong();
      break;
    case 'prev':
      await prevSong();
      break;
    case 'focus-tab':
      await openPiPTab();
      break;
  }
});

/**
 * If there's a PiP video, try to play/pause that video
 * Else,
 *  Find current audible tab => toggle youtube video (might be youtube page or iframe inside another page) inside that page
 *  Else,
 *    Find current active tab => toggle 
 */
async function togglePlayPause() {
  return getActiveFrameForControlling()
    .then(result => {
      if (result) {
        return executeScript(result.tab, {file: "toggle_play_pause_video.js", allFrames: false, frameId: result.frameId});
      }
    });
}
/**
 * Logic to toogle PiP
 * - Find current document with YTB PiP element and exit that
 * If there's no PiP window
 * - If there's an active tab => {
 *    - If tab is Youtube tab => active PiP for the main video
 *    - If tab has multiple YTB frames -> Show UI to select which iframe to PiP -> with playing video on top
 * }
 * - No Active tab => find audible tabs in lastfocused window
 *    - find first audible tab that contains a YTB player (youtube or other pages) to active PiP
 *    - What if an audible tab has multiple playing YTB Player=> pick the first one
 * }
 */
var lastExitedPiPFrame = null;
async function togglePip() {
  return getPiPHostFrame()
    .then(frame => {
      lastExitedPiPFrame = frame;
      return executeScript(frame.tab, {code: "document.exitPictureInPicture()", allFrames: false, frameId: frame.frameId});
    })
    .catch(async _ => getTargetYTBFrameForPiP().then(enablePip))
    .catch(err => {
      if (lastExitedPiPFrame) {
        return enablePip(lastExitedPiPFrame);
      }
      console.log("Err finding frame to toggle PiP", err);
    });
}

async function getTargetYTBFrameForPiP() {
  return queryTabs({highlighted: true, lastFocusedWindow: true})
    .then(activeTabs => {
      const activeTab = activeTabs[0];
      if (activeTab && isYoutubeTab(activeTab)) {
        return new YTBFrame(0, activeTab);
      }

      throw NO_PLAYING_YTB_FRAME;
    })
    .catch(async _ => {
      const audibleFrame = await getAudibleYTBFrame();
      if (audibleFrame) {
        return audibleFrame;
      }
      throw NO_PLAYING_YTB_FRAME;
    });
}

//https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
async function increasePlaybackRate() {
  return getPiPHostFrame()
    .then(async frame => {
      console.log("Increase playback rate", frame);
      const scriptResult = await executeScript(frame.tab, {file: "increase_speed.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to increase speed PiP", scriptResult);
    });
}

async function decreasePlaybackRate() {
  return getPiPHostFrame()
  .then(async frame => {
    console.log("Decrease playback rate", frame);
    const scriptResult = await executeScript(frame.tab, {file: "decrease_speed.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to decrease speed PiP", scriptResult);
      return;
  });
}

async function fastForward() {
  return getPiPHostFrame()
    .then(async frame => {
      console.log("FF", frame);
      const scriptResult = await executeScript(frame.tab, {file: "fast_forward.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to fast forward PiP", scriptResult);
    });
}

async function backward() {
  return getPiPHostFrame()
    .then(async frame => {
      console.log("BW", frame);
      const scriptResult = await executeScript(frame.tab, {file: "backward.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to backward PiP", scriptResult);
    });
}


async function nextSong() {
  return getActiveFrameForControlling()
    .then(async frame => {
      console.log("Next song", frame);
      await executeScript(frame.tab, {file: "next_song.js", allFrames: false, frameId: frame.frameId});
    });
}

async function prevSong() {
  return getActiveFrameForControlling()
    .then(async frame => {
      console.log("Prev song", frame);
      await executeScript(frame.tab, {file: "prev_song.js", allFrames: false, frameId: frame.frameId});
    });
}

async function openPiPTab() {
  return getPiPHostFrame()
    .then(frame => {
      chrome.tabs.highlight({windowId: frame.tab.windowId, tabs: [frame.tab.index]}, window => {
        console.log("After highlight", window);
        chrome.windows.update(frame.tab.windowId, {focused: true}, window => {
          console.log("After focus", window);
        });
      });
    })
}

/**
 * Get youtube's page picture in picture element
 * OR
 * Get first youtube's iframe in other pages that contains PiP element
 */
async function getPiPHostFrame() {
  return queryTabs()
    .then(async tabs => {
      const ytbFrames = tabs
          .filter(tab => isYoutubeTab(tab))
          .map(tab => new YTBFrame(0, tab));
      const activePiP = await filterPiPFrame(ytbFrames);
      if (activePiP) {
        return activePiP;
      }

      const otherTabs = tabs.filter(tab => !isYoutubeTab(tab));
      for (tab of otherTabs) {
        const ytbFrames = await getYTBFramesInTab(tab);
        if (ytbFrames && ytbFrames.length > 0) {
          const framePiP = await filterPiPFrame(ytbFrames);
          if (framePiP) {
            return framePiP;
          }
        }
      }
      throw NO_ACTIVE_PIP_FRAME;
    });
}

async function getYTBFramesInTab(tab) {
  return new Promise(function (resolve, reject) {
    chrome.webNavigation.getAllFrames({tabId: tab.id}, iFrames => {
      const ytbIFrames = iFrames
          .filter(frame => frame.url.includes("youtube.com"))
          .map(frame => new YTBFrame(frame.frameId, tab));
      resolve(ytbIFrames);
    });
  });
}

async function filterPiPFrame(ytbFrames) {
  for (ytbFrame of ytbFrames) {
    const pipCheckResult = await executeScript(ytbFrame.tab, {code: "document.pictureInPictureElement", allFrames: false, frameId: ytbFrame.frameId});
    if (pipCheckResult && pipCheckResult[0]) {
      return ytbFrame;
    }
  }
  return null;
}

/**
 * Get first playing youtube player frame inside all audible tabs.
 */
async function getAudibleYTBFrame() {
  var audibleTabs = await queryTabs({audible: true, lastFocusedWindow: true});
  if (!audibleTabs || audibleTabs.length == 0) {
    audibleTabs = await queryTabs({audible: true});
  }
  audibleTabs = audibleTabs.sort((tab1, tab2) => {
    if (tab1.active ^ tab2.active) {
      if (tab1.active) {
        return -1;
      } else {
        return 1;
      }
    } else {
      return tab1.id - tab2.id;
    }
  });
  for (audibleTab of audibleTabs) {
    if (isYoutubeTab(audibleTab)) {
      return Promise.resolve(new YTBFrame(0, audibleTab));
    }
    const playingFrame = await getYTBFramesInTab(audibleTab)
      .then(async frames => {
        for (frame of frames) {
          const scriptResult = await executeScript(audibleTab, {file: "check_playing_player.js", frameId: frame.frameId});
          if (scriptResult && scriptResult[0]) {
            return frame;
          }
        }
        return null;
      });
    if (playingFrame) {
      return Promise.resolve(playingFrame);
    }
  }
  return Promise.resolve(null);
}

/**
 * First get the active PiP
 * If no active PiP,
 * - Check active tab to find a playing player
 * - No active tab, use audible tab: 
 * 
 * 
 */
async function getActiveFrameForControlling() {
  return getPiPHostFrame()
    .catch(async err => {
      if (err != NO_ACTIVE_PIP_FRAME) {
        throw err
      }
      const tabs = await queryTabs({ url: "https://*.youtube.com/*" });
      const audibleTabs = tabs.filter(tab => tab.audible == true);
      if (audibleTabs.length > 0) {
        return new YTBFrame(0, audibleTabs[0]);
      }
      const activeTabs = tabs.filter(tab => tab.active == true);
      if (activeTabs.length > 0) {
        return new YTBFrame(0, activeTabs[0]);
      }
      return null;
    });
}

async function enablePip(ytbFrame) {
  lastExitedPiPFrame = ytbFrame;
  return executeScript(ytbFrame.tab, { file: 'active_pip.js', allFrames: true, frameId: ytbFrame.frameId });
}

function queryTabs(details) {
  return new Promise(function(resolve, reject) {
    if (details == null) {
      details = {};
    }
    chrome.tabs.query(details, tabs => {
      console.log("Query Tabs", details, tabs);
      resolve(tabs);
    });
  });
}

function executeScript(tab, option) {
  return new Promise(function(resolve, reject) {
      chrome.tabs.executeScript(tab.id, option, result => {
        console.log("Execute script for tab %d title:%s",tab.id, tab.title, option, result);
        if (result && result[0] != null) {
          resolve(result);
        } else {
          resolve(null);
        }
      });
    });
}