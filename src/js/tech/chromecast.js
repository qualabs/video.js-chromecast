/**
 * @file chromecast.js
 * Chromecast Media Controller - Wrapper for HTML5 Media API
 */
import videojs from 'video.js';

const Component = videojs.getComponent('Component');
const Tech = videojs.getComponent('Tech');

/**
 * Chromecast Media Controller - Wrapper for HTML5 Media API
 *
 * @param {Object=} options Object of option names and values
 * @param {Function=} ready Ready callback function
 * @extends Tech
 * @class Chromecast
 */

class Chromecast extends Tech {
    constructor (options, ready) {
        super(options, ready);
        this.apiMedia = this.options_.source.apiMedia;
        this.apiSession = this.options_.source.apiSession;
        this.receiver = this.apiSession.receiver.friendlyName;
        this.activeTracks = null;

        this.changeHandler = ::this.handleTracksChange;
        let mediaStatusUpdateHandler = ::this.onMediaStatusUpdate;
        let sessionUpdateHanlder = ::this.onSessionUpdate;

        this.apiMedia.addUpdateListener(mediaStatusUpdateHandler);
        this.apiSession.addUpdateListener(sessionUpdateHanlder);

        this.on('dispose', () => {
          this.apiMedia.removeUpdateListener(mediaStatusUpdateHandler);
          this.apiSession.removeUpdateListener(sessionUpdateHanlder);
          this.onMediaStatusUpdate()
          this.onSessionUpdate(false);
        });

        // Load to VideoJS Remote Audio and Text Tracks
        this.one('playing', () => {
          this.loadTracks();
          this.loadVolume();
          this.update();
          this.triggerReady();
        });
    }

    loadVolume () {
        const {volume} = this.apiMedia;

        if (volume) {
            this.volume_ = volume.level;
            this.muted_ = volume.muted;
            
            this.trigger('volumechange');
        }
    }

    loadTracks () {
      const tracks = this.apiMedia.media.tracks;
      const activeTracksIds = this.apiMedia.activeTrackIds;

      tracks.forEach((track) => {
        const isActive = activeTracksIds && activeTracksIds.indexOf(track.trackId) > -1;

        if (track.type === chrome.cast.media.TrackType.AUDIO) {
          this.createAudioTrack_(track, isActive);
        }

        if (track.type === chrome.cast.media.TrackType.TEXT) {
          this.createTextTrack_(track, isActive);
        }
      })

      let playerTracks = this.textTracks();
      if (playerTracks) {
        playerTracks.addEventListener('change', this.changeHandler);
        this.on('dispose', function () {
            playerTracks.removeEventListener('change', this.changeHandler);
        });
      }

      playerTracks = this.audioTracks();
      if (playerTracks) {
        playerTracks.addEventListener('change', this.changeHandler);
        this.on('dispose', function () {
            playerTracks.removeEventListener('change', this.changeHandler);
        });
      }
    }

    createAudioTrack_ (track, isActive) {
      const audioTrack = new videojs.AudioTrack({
        id: track.trackId,
        kind: 'translation',
        label: track.language,
        language: track.language,
        enabled: isActive
      });

      this.audioTracks().addTrack(audioTrack);
    }

    createTextTrack_ (track, isActive) {
      if (track.language) {
        const mode = isActive ? 'showing' : 'disabled';

        const textTrack = new videojs.TextTrack({
            id: track.trackId,
            tech: this,
            kind: 'subtitles',
            mode: mode, // disabled, hidden, showing
            label: track.language,
            language: track.language,
            srclang: track.language,
            default: false // Video.js will choose the first track that is marked as default and turn it on
        });

        this.textTracks().addTrack(textTrack);
      }
    }

    createEl () {
        let el = videojs.dom.createEl('div', {
            id: this.options_.techId,
            className: 'vjs-tech vjs-tech-chromecast'
        });
        return el;
    }

    update () {
        this.el_.innerHTML = `<div class="casting-image" style="background-image: url('${this.options_.poster}')"></div><div class="casting-overlay"><div class="casting-information"><div class="casting-icon"></div><div class="casting-description"><small>${this.localize('CASTING TO')}</small><br>${this.receiver}</div></div></div>`;
    }

    onSessionUpdate (isAlive) {
        if (!this.apiMedia) {
            return;
        }
        if (!isAlive) {
            return this.onStopAppSuccess();
        }
    }

    onStopAppSuccess () {
        this.stopTrackingCurrentTime();
        this.apiMedia = null;
    }

    onMediaStatusUpdate () {
        if (!this.apiMedia) {
            return;
        }

        if (!this.activeTracks || JSON.stringify(this.activeTracks.sort()) !== JSON.stringify(this.apiMedia.activeTrackIds.sort())){
            this.onActiveTrackChange(this.apiMedia.activeTrackIds || []);
            this.activeTracks = this.apiMedia.activeTrackIds;
        }

        switch (this.apiMedia.playerState) {
            case chrome.cast.media.PlayerState.BUFFERING:
                this.trigger('waiting');
                break;
            case chrome.cast.media.PlayerState.IDLE:
                this.trigger('timeupdate');
                this.trigger('ended');

                break;
            case chrome.cast.media.PlayerState.PAUSED:
                this.trigger('pause');
                this.paused_ = true;
                break;
            case chrome.cast.media.PlayerState.PLAYING:
                this.trigger('playing');
                this.trigger('play');
                this.paused_ = false;
                break;
        }
    }


    /**
     * Set video
     *
     * @param {Object=} src Source object
     * @method setSrc
     */
    src (src) {}

    currentSrc () {
        if (!this.apiMedia) {
            return;
        }
        return this.apiMedia.media.contentId;
    }

    handleTracksChange () {
      let trackInfo = [];
      let audioTracks = this.audioTracks().tracks_;
      let textTracks = this.textTracks().tracks_;

      audioTracks.forEach((t) => {
        if (t.enabled) {
            trackInfo.push(t.id);
        }
      });

      textTracks.forEach((t) => {
        if (t.mode === 'showing') {
            trackInfo.push(t.id);
        }
      });

      if (this.apiMedia && trackInfo.length) {
          this.tracksInfoRequest = new chrome.cast.media.EditTracksInfoRequest(trackInfo);
          return this.apiMedia.editTracksInfo(this.tracksInfoRequest, ::this.onTrackSuccess, ::this.onTrackError);
      }
    }

    onActiveTrackChange (activeTrackIds) {
      let audioTracks = this.audioTracks();
      let textTracks = this.textTracks();

      // removeEventListener because when we set the activeTracks, the event
      // handleTracksChange fires and it enters in loop.
      audioTracks.removeEventListener('change', this.changeHandler);
      textTracks.removeEventListener('change', this.changeHandler);

      audioTracks.tracks_.forEach((t) => {
        if (activeTrackIds.indexOf(t.id) > -1) {
          t.enabled = true;
        } else {
          t.enabled = false;
        }
      });

      textTracks.tracks_.forEach((t) => {
        if (activeTrackIds.indexOf(t.id) > -1) {
          t.mode = 'showing';
        } else {
          t.mode = 'disabled';
        }
      });

      audioTracks.addEventListener('change', this.changeHandler);
      textTracks.addEventListener('change', this.changeHandler);
    }

    onTrackSuccess () {
        return videojs.log('track added');
    }

    onTrackError (e) {
        return videojs.log('Cast track Error: ' + JSON.stringify(e));
    }

    castError (e) {
        return videojs.log('Cast Error: ' + JSON.stringify(e));
    }

    play () {
        if (!this.apiMedia) {
            return;
        }
        if (this.paused_) {
            this.apiMedia.play(null, this.mediaCommandSuccessCallback.bind(this, 'Playing: ' + this.apiMedia.sessionId), ::this.castError);
        }
        return this.paused_ = false;
    }

    pause () {
        if (!this.apiMedia) {
            return;
        }
        if (!this.paused_) {
            this.apiMedia.pause(null, this.mediaCommandSuccessCallback.bind(this, 'Paused: ' + this.apiMedia.sessionId), ::this.castError);
            return this.paused_ = true;
        }
    }

    paused () {
        return this.paused_;
    }

    ended () {
      return chrome.cast.media.IdleReason === "FINISHED";
    }

    currentTime () {
        if (!this.apiMedia) {
            return 0;
        }
        return this.apiMedia.getEstimatedTime();
    }

    setCurrentTime (position) {

        if (!this.apiMedia) {
            return 0;
        }
        let request;
        request = new chrome.cast.media.SeekRequest();
        request.currentTime = position;
        //if (this.player_.controlBar.progressControl.seekBar.videoWasPlaying) {
        //  request.resumeState = chrome.cast.media.ResumeState.PLAYBACK_START;
        //}
        return this.apiMedia.seek(request, this.onSeekSuccess.bind(this, position), ::this.castError);
    }

    onSeekSuccess (position) {
        videojs.log('seek success' + position);
    }

    volume () {
        return this.volume_;
    }

    duration () {
        if (!this.apiMedia) {
            return 0;
        }
        return this.apiMedia.media.duration || Infinity;
    }

    controls () {
        return false;
    }

    setVolume (level, mute = false) {
        let request;
        let volume;
        if (!this.apiMedia) {
            return;
        }
        volume = new chrome.cast.Volume();
        volume.level = level;
        volume.muted = mute;
        this.volume_ = volume.level;
        this.muted_ = mute;
        request = new chrome.cast.media.VolumeRequest();
        request.volume = volume;
        this.apiMedia.setVolume(request, this.mediaCommandSuccessCallback.bind(this, 'Volume changed'), ::this.castError);
        return this.trigger('volumechange');
    }

    mediaCommandSuccessCallback (information) {
        videojs.log(information);
    }

    muted () {
        return this.muted_;
    }

    setMuted (muted) {
        return this.setVolume(this.volume_, muted);
    }

    supportsFullScreen () {
        return false;
    }


    resetSrc_ (callback) {
        callback();
    }

    dispose () {
        this.resetSrc_(Function.prototype);
        super.dispose(this);
    }

}

Chromecast.prototype.paused_ = false;

Chromecast.prototype.options_ = {};

Chromecast.prototype.timerStep = 1000;

/* Chromecast Support Testing -------------------------------------------------------- */

Chromecast.isSupported = function () {
    return true;
};

// Add Source Handler pattern functions to this tech
Tech.withSourceHandlers(Chromecast);

/*
 * The default native source handler.
 * This simply passes the source to the video element. Nothing fancy.
 *
 * @param  {Object} source   The source object
 * @param  {Flash} tech  The instance of the Flash tech
 */
Chromecast.nativeSourceHandler = {};

/**
 * Check if Flash can play the given videotype
 * @param  {String} type    The mimetype to check
 * @return {String}         'probably', 'maybe', or '' (empty string)
 */
Chromecast.nativeSourceHandler.canPlayType = function (source) {

    const dashTypeRE = /^application\/(?:dash\+xml|(x-|vnd\.apple\.)mpegurl)/i;
    const dashExtRE = /^video\/(mpd|mp4|webm|m3u8)/i;

    if (dashTypeRE.test(source)) {
        return 'probably';
    } else if (dashExtRE.test(source)) {
        return 'maybe';
    } else {
        return '';
    }

};

/*
 * Check Flash can handle the source natively
 *
 * @param  {Object} source  The source object
 * @return {String}         'probably', 'maybe', or '' (empty string)
 */
Chromecast.nativeSourceHandler.canHandleSource = function (source) {

    // If a type was provided we should rely on that
    if (source.type) {
        return Chromecast.nativeSourceHandler.canPlayType(source.type);
    } else if (source.src) {
        return Chromecast.nativeSourceHandler.canPlayType(source.src);
    }

    return '';
};

/*
 * Pass the source to the flash object
 * Adaptive source handlers will have more complicated workflows before passing
 * video data to the video element
 *
 * @param  {Object} source    The source object
 * @param  {Flash} tech   The instance of the Flash tech
 */
Chromecast.nativeSourceHandler.handleSource = function (source, tech) {
    tech.src(source.src);
};

/*
 * Clean up the source handler when disposing the player or switching sources..
 * (no cleanup is needed when supporting the format natively)
 */
Chromecast.nativeSourceHandler.dispose = function () {
};

// Register the native source handler
Chromecast.registerSourceHandler(Chromecast.nativeSourceHandler);


/*
 * Set the tech's volume control support status
 *
 * @type {Boolean}
 */
Chromecast.prototype['featuresVolumeControl'] = true;

/*
 * Set the tech's playbackRate support status
 *
 * @type {Boolean}
 */
Chromecast.prototype['featuresPlaybackRate'] = false;

/*
 * Set the tech's status on moving the video element.
 * In iOS, if you move a video element in the DOM, it breaks video playback.
 *
 * @type {Boolean}
 */
Chromecast.prototype['movingMediaElementInDOM'] = false;

/*
 * Set the the tech's fullscreen resize support status.
 * HTML video is able to automatically resize when going to fullscreen.
 * (No longer appears to be used. Can probably be removed.)
 */
Chromecast.prototype['featuresFullscreenResize'] = false;

/*
 * Set the tech's timeupdate event support status
 * (this disables the manual timeupdate events of the Tech)
 */
Chromecast.prototype['featuresTimeupdateEvents'] = false;

/*
 * Set the tech's progress event support status
 * (this disables the manual progress events of the Tech)
 */
Chromecast.prototype['featuresProgressEvents'] = false;

/*
 * Sets the tech's status on native text track support
 *
 * @type {Boolean}
 */
Chromecast.prototype['featuresNativeTextTracks'] = false;

/*
 * Sets the tech's status on native audio track support
 *
 * @type {Boolean}
 */
Chromecast.prototype['featuresNativeAudioTracks'] = false;

/*
 * Sets the tech's status on native video track support
 *
 * @type {Boolean}
 */
Chromecast.prototype['featuresNativeVideoTracks'] = false;


videojs.options.chromecast = {};

Tech.registerTech('Chromecast', Chromecast);

export default Chromecast;
