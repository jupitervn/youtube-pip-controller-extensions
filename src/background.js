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
 *  Find current audible tab => toggle youtube video (might be youtube page or iframe inside another page) inside that page
 *  Else,
 *    Find current active tab => toggle 
 */
async function togglePlayPause() {
  return getProperTab()
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
async function togglePip() {
  return getActivePiPFrame()
    .then(result => executeScript(result.tab, {code: "document.exitPictureInPicture()", allFrames: false, frameId: result.frameId}))
    .catch(err => {
      if (err != NO_ACTIVE_PIP_FRAME) {
        throw err;
      }
      return getTargetYTBFrameForPiP()
        .then(frame => enablePip(frame));
    })
    .catch(err => {
      console.log("Err finding frame to toggle PiP", err);
    })
}

async function getTargetYTBFrameForPiP() {
  return queryTabs({active: true, lastFocusedWindow: true})
    .then(activeTabs => {
      const activeTab = activeTabs[0];
      if (activeTab) {
        if (isYoutubeTab(activeTab)) {
          return new YTBFrame(0, activeTab);
        }
        //TODO: Show UI
      }
      throw NO_PLAYING_YTB_FRAME;
    })
    .catch(async err => {
      if (err != NO_PLAYING_YTB_FRAME) {
        throw err;
      }
      const audibleFrame = await getAudibleYTBFrame();
      if (audibleFrame) {
        return audibleFrame;
      }
      throw NO_PLAYING_YTB_FRAME;
    });
}

//https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
function increasePlaybackRate() {
  getActivePiPFrame()
  .then(async result => {
    console.log("Increase playback rate", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.tab, {file: "increase_speed.js", allFrames: false, frameId: frameId});
      console.log("Try to increase speed PiP", scriptResult);
      return;
    }
  });
}

function decreasePlaybackRate() {
  getActivePiPFrame()
  .then(async result => {
    console.log("Decrease playback rate", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.tab, {file: "decrease_speed.js", allFrames: false});
      console.log("Try to decrease speed PiP", scriptResult);
      return;
    }
  });
}

function fastForward() {
  getActivePiPFrame()
    .then(async result => {
      console.log("FF", result);
      if (result.pipTab) {
        const scriptResult = await executeScript(result.pipTab, {file: "fast_forward.js", allFrames: false});
        console.log("Try to fast forward PiP", scriptResult);
        return;
      }
    });
}

function backward() {
  getActivePiPFrame()
  .then(async result => {
    console.log("BW", result);
    if (result.pipTab) {
      const scriptResult = await executeScript(result.pipTab, {file: "backward.js", allFrames: false});
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
      await executeScript(tab, {file: "next_song.js", allFrames: false});
    });
}

function prevSong() {
  getProperTab()
  .then(async tab => {
    console.log("Prev song", tab);
    await executeScript(tab, {file: "prev_song.js", allFrames: false});
  });
}

/**
 * Get youtube's page picture in picture element
 * OR
 * Get first youtube's iframe in other pages that contains PiP element
 */
async function getActivePiPFrame() {
  return queryTabs()
    .then(async tabs => {
      const ytbFrames = tabs
          .filter(tab => isYoutubeTab(tab))
          .map(tab => new YTBFrame(0, tab));
      const activePiP = await findFirstPiPFrame(ytbFrames);
      console.log("Find youtube tab with PiP element", activePiP);
      if (activePiP) {
        return activePiP;
      }

      const otherTabs = tabs.filter(tab => !isYoutubeTab(tab));
      for (tab of otherTabs) {
        const ytbFrames = await getYTBFramesInTab(tab);
        if (ytbFrames && ytbFrames.length > 0) {
          const framePiP = await findFirstPiPFrame(ytbFrames);
          console.log("Got Youtube IFrame", framePiP);
          if (framePiP) {
            return framePiP;
          }
        }
      }
      throw NO_ACTIVE_PIP_FRAME;
    });
}

function getYTBFramesInTab(tab) {
  return new Promise(function (resolve, reject) {
    chrome.webNavigation.getAllFrames({tabId: tab.id}, iFrames => {
      const ytbIFrames = iFrames
          .filter(frame => frame.url.includes("youtube.com"))
          .map(frame => new YTBFrame(frame.frameId, tab));
      resolve(ytbIFrames);
    });
  });
}

async function findFirstPiPFrame(ytbFrames) {
  for (ytbFrame of ytbFrames) {
    const pipCheckResult = await executeScript(ytbFrame.tab, {code: "document.pictureInPictureElement", allFrames: false, frameId: ytbFrame.frameId});
    if (pipCheckResult && pipCheckResult[0]) {
      return ytbFrame;
    }
  }
  return null;
}

async function getAudibleYTBFrame() {
  const audibleTabs = await queryTabs({audible: true, lastFocusedWindow: true})
        .then(tabs => {
          if (tabs.length == 0) {
            return queryTabs({audible: true});
          } else {
            return Promise.resolve(tabs);
          }
        });

  console.log("Checking audible tabs", audibleTabs);
  for (audibleTab of audibleTabs) {
    if (isYoutubeTab(audibleTab)) {
      return enablePip(new YTBFrame(0, audibleTab));
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

async function getProperTab() {
  return getActivePiPFrame()
    .then(pipFrame => pipFrame)
    .catch(err => {
      if (err != NO_ACTIVE_PIP_FRAME) {
        throw err
      }
      return queryTabs({url: "https://*.youtube.com/*"})
        .then(tabs => {
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
    });
}

function enablePip(ytbFrame) {
  executeScript(ytbFrame.tab, { file: 'active_pip.js', allFrames: false, frameId: ytbFrame.frameId });
}

function queryTabs(details) {
  return new Promise(function(resolve, reject) {
    if (details == null) {
      details = {};
    }
    chrome.tabs.query(details, tabs => {
      console.log("Query Tabs", tabs);
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