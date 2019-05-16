function YTBFrame(frameId, tab, url) {
  this.frameId = frameId;
  this.tab = tab;
  this.url = url;
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
    case '1_video_toggle_pip':
      await togglePip();
      break;
    case '2_focus_tab':
      await openPiPTab();
      break;
    case '3_playback_play_pause':
      await togglePlayPause();
      break;
    case '4_playback_next':
      await nextSong();
      break;
    case '5_playback_prev':
      await prevSong();
      break;
    case '6_playback_fast_forward':
      await fastForward();
      break;
    case '7_playback_backward':
      await backward();
      break;
    case '8_playback_increase_speed':
      await increasePlaybackRate();
      break;
    case '9_playback_decrease_speed':
      await decreasePlaybackRate();
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
  return getPiPHostFrame()
    .then(async result => {
      await executeScript(result.tab, {file: "toggle_play_pause_video.js", allFrames: false, frameId: result.frameId});
      return true;
    })
    .catch(async err => {
      const audibleTabs = await getAudibleTabs();
      var hasVideoToPause = false;
      for (audibleTab of audibleTabs) {
        if (isYoutubeTab(audibleTab)) {
          hasVideoToPause = true
          await executeScript(audibleTab, {file: "toggle_play_pause_video.js", allFrames: false, frameId: 0});
        } else {
          const allPlayingFrames = await getPlayingYTBFramesInTab(audibleTab);
          console.log("Current playing frames", allPlayingFrames);
          hasVideoToPause = allPlayingFrames.length > 0;
          for (playingFrame of allPlayingFrames) {
            await executeScript(playingFrame.tab, {file: "toggle_play_pause_video.js", allFrames: false, frameId: playingFrame.frameId});
          }
        }
      }
      return hasVideoToPause;
    }).then(async alreadyPauseVideo => {
      console.log("Should play a video", !alreadyPauseVideo);
      if (!alreadyPauseVideo) {
        //Try to play the most visible video in active tab
        const largestFrame = await getLargestYTBFrameInActiveTab();
        await executeScript(largestFrame.tab, {file: "toggle_play_pause_video.js", allFrames: false, frameId: largestFrame.frameId});
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
  return queryTabs({active: true, lastFocusedWindow: true})
    .then(async activeTabs => {
      const activeTab = activeTabs[0];
      if (activeTab) {
        if (isYoutubeTab(activeTab)) {
          return new YTBFrame(0, activeTab);
        }
        const playingFrame = (await getPlayingYTBFramesInTab(activeTab, true))[0];
        if (playingFrame) {
          return playingFrame;
        }
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
    .catch(err => getLargestYTBFrameInActiveTab())
    .then(async frame => {
      console.log("Increase playback rate", frame);
      const scriptResult = await executeScript(frame.tab, {file: "increase_speed.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to increase speed PiP", scriptResult);
    });
}

async function decreasePlaybackRate() {
  return getPiPHostFrame()
  .catch(err => getLargestYTBFrameInActiveTab())
  .then(async frame => {
    console.log("Decrease playback rate", frame);
    const scriptResult = await executeScript(frame.tab, {file: "decrease_speed.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to decrease speed PiP", scriptResult);
      return;
  });
}

async function fastForward() {
  return getPiPHostFrame()
    .catch(err => getLargestYTBFrameInActiveTab())
    .then(async frame => {
      console.log("FF", frame);
      const scriptResult = await executeScript(frame.tab, {file: "fast_forward.js", allFrames: false, frameId: frame.frameId});
      console.log("Try to fast forward PiP", scriptResult);
    });
}

async function backward() {
  return getPiPHostFrame()
    .catch(err => getLargestYTBFrameInActiveTab())
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
        chrome.windows.update(frame.tab.windowId, {focused: true});
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
          .map(frame => new YTBFrame(frame.frameId, tab, frame.url));
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

async function getLargestYTBFrameInActiveTab() {
  const activeTab = (await queryTabs({highlighted: true, lastFocusedWindow: true}))[0];
  if (!activeTab) {
    return Promise.reject(NO_PROPER_FRAME_FOUND);
  }
  var allFrames = (await getYTBFramesInTab(activeTab));
  if (allFrames.length > 0) {
    const framesRect = (await executeScript(activeTab, {file: "get_frame_visible_rect.js", allFrames: false, frameId: 0}))[0];
    allFrames = allFrames.sort((f1, f2) => {
        return framesRect[f2.url] - framesRect[f1.url];
      });
    const mostVisibleFrame = allFrames[0];
    if (mostVisibleFrame && framesRect[mostVisibleFrame.url] > 0) {
      return Promise.resolve(mostVisibleFrame);
    }
  }
  return Promise.reject(NO_PROPER_FRAME_FOUND);
}

async function getAudibleTabs() {
  var audibleTabs = await queryTabs({audible: true, lastFocusedWindow: true, muted: false});
  if (!audibleTabs || audibleTabs.length == 0) {
    audibleTabs = await queryTabs({audible: true, muted: false});
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
  return audibleTabs;
}

/**
 * Get first playing youtube player frame inside all audible tabs.
 */
async function getAudibleYTBFrame() {
  const audibleTabs = await getAudibleTabs();
  for (audibleTab of audibleTabs) {
    if (isYoutubeTab(audibleTab)) {
      return Promise.resolve(new YTBFrame(0, audibleTab));
    }
    const playingFrame = (await getPlayingYTBFramesInTab(audibleTab, true))[0];
    console.log("Found playing frame", playingFrame);
    if (playingFrame) {
      return Promise.resolve(playingFrame);
    }
  }
  return Promise.resolve(null);
}

async function getPlayingYTBFramesInTab(tab, isEarlyStop) {
  const frames = await getYTBFramesInTab(tab);
  const playingFrames = [];
  for (frame of frames) {
    const scriptResult = await executeScript(tab, {file: "check_playing_player.js", frameId: frame.frameId});
    if (scriptResult && scriptResult[0]) {
      if (isEarlyStop) {
        return [frame];
      }
      playingFrames.push(frame);
    }
  }
  return playingFrames;
} 

/**
 * First get the active PiP
 * - No Active PiP
 * => Find Audible tabs, If there's audible tabs => pause videos inside that.
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