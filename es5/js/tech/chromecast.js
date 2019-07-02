/**
 * @file chromecast.js
 * Chromecast Media Controller - Wrapper for HTML5 Media API
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { var object = _x2, property = _x3, receiver = _x4; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _videoJs = require('video.js');

var _videoJs2 = _interopRequireDefault(_videoJs);

var Component = _videoJs2['default'].getComponent('Component');
var Tech = _videoJs2['default'].getComponent('Tech');

/**
 * Chromecast Media Controller - Wrapper for HTML5 Media API
 *
 * @param {Object=} options Object of option names and values
 * @param {Function=} ready Ready callback function
 * @extends Tech
 * @class Chromecast
 */

var Chromecast = (function (_Tech) {
    _inherits(Chromecast, _Tech);

    function Chromecast(options, ready) {
        var _this = this;

        _classCallCheck(this, Chromecast);

        _get(Object.getPrototypeOf(Chromecast.prototype), 'constructor', this).call(this, options, ready);
        this.apiMedia = this.options_.source.apiMedia;
        this.apiSession = this.options_.source.apiSession;
        this.receiver = this.apiSession.receiver.friendlyName;
        this.activeTracks = null;

        this.changeHandler = this.handleTracksChange.bind(this);
        var mediaStatusUpdateHandler = this.onMediaStatusUpdate.bind(this);
        var sessionUpdateHanlder = this.onSessionUpdate.bind(this);

        this.apiMedia.addUpdateListener(mediaStatusUpdateHandler);
        this.apiSession.addUpdateListener(sessionUpdateHanlder);

        this.on('dispose', function () {
            _this.apiMedia.removeUpdateListener(mediaStatusUpdateHandler);
            _this.apiSession.removeUpdateListener(sessionUpdateHanlder);
            _this.onMediaStatusUpdate();
            _this.onSessionUpdate(false);
        });

        // Load to VideoJS Remote Audio and Text Tracks
        this.loadTracks();

        this.update();
        this.triggerReady();
    }

    _createClass(Chromecast, [{
        key: 'loadTracks',
        value: function loadTracks() {
            var _this2 = this;

            var tracks = this.apiMedia.media.tracks;
            var activeTracksId = this.apiMedia.activeTrackIds;

            tracks.forEach(function (track) {
                var isActive = activeTracksId.indexOf(track.trackId) > -1;

                if (track.type === chrome.cast.media.TrackType.AUDIO) {
                    _this2.createAudioTrack_(track, isActive);
                }

                if (track.type === chrome.cast.media.TrackType.TEXT) {
                    _this2.createTextTrack_(track, isActive);
                }
            });

            var playerTracks = this.textTracks();
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
    }, {
        key: 'createAudioTrack_',
        value: function createAudioTrack_(track, isActive) {
            var audioTrack = new _videoJs2['default'].AudioTrack({
                id: track.trackId,
                kind: 'translation',
                label: track.language,
                language: track.language,
                enabled: isActive
            });

            this.audioTracks().addTrack(audioTrack);
        }
    }, {
        key: 'createTextTrack_',
        value: function createTextTrack_(track, isActive) {
            var mode = isActive ? 'showing' : 'disabled';

            var textTrack = new _videoJs2['default'].TextTrack({
                id: track.trackId,
                tech: this,
                kind: 'subtitles',
                mode: mode, // disabled, hidden, showing
                label: track.language,
                language: track.language,
                srclang: track.language,
                'default': false // Video.js will choose the first track that is marked as default and turn it on
            });

            this.textTracks().addTrack(textTrack);
        }
    }, {
        key: 'createEl',
        value: function createEl() {
            var el = _videoJs2['default'].dom.createEl('div', {
                id: this.options_.techId,
                className: 'vjs-tech vjs-tech-chromecast'
            });
            return el;
        }
    }, {
        key: 'update',
        value: function update() {
            this.el_.innerHTML = '<div class="casting-image" style="background-image: url(\'' + this.options_.poster + '\')"></div><div class="casting-overlay"><div class="casting-information"><div class="casting-icon"></div><div class="casting-description"><small>' + this.localize('CASTING TO') + '</small><br>' + this.receiver + '</div></div></div>';
        }
    }, {
        key: 'onSessionUpdate',
        value: function onSessionUpdate(isAlive) {
            if (!this.apiMedia) {
                return;
            }
            if (!isAlive) {
                return this.onStopAppSuccess();
            }
        }
    }, {
        key: 'onStopAppSuccess',
        value: function onStopAppSuccess() {
            this.stopTrackingCurrentTime();
            this.apiMedia = null;
        }
    }, {
        key: 'onMediaStatusUpdate',
        value: function onMediaStatusUpdate() {
            if (!this.apiMedia) {
                return;
            }

            if (!this.activeTracks || JSON.stringify(this.activeTracks.sort()) !== JSON.stringify(this.apiMedia.activeTrackIds.sort())) {
                this.onActiveTrackChange(this.apiMedia.activeTrackIds);
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
    }, {
        key: 'src',
        value: function src(_src) {}
    }, {
        key: 'currentSrc',
        value: function currentSrc() {
            if (!this.apiMedia) {
                return;
            }
            return this.apiMedia.media.contentId;
        }
    }, {
        key: 'handleTracksChange',
        value: function handleTracksChange() {
            var trackInfo = [];
            var audioTracks = this.audioTracks().tracks_;
            var textTracks = this.textTracks().tracks_;

            audioTracks.forEach(function (t) {
                if (t.enabled) {
                    trackInfo.push(t.id);
                }
            });

            textTracks.forEach(function (t) {
                if (t.mode === 'showing') {
                    trackInfo.push(t.id);
                }
            });

            if (this.apiMedia && trackInfo.length) {
                this.tracksInfoRequest = new chrome.cast.media.EditTracksInfoRequest(trackInfo);
                return this.apiMedia.editTracksInfo(this.tracksInfoRequest, this.onTrackSuccess.bind(this), this.onTrackError.bind(this));
            }
        }
    }, {
        key: 'onActiveTrackChange',
        value: function onActiveTrackChange(activeTrackIds) {
            var audioTracks = this.audioTracks();
            var textTracks = this.textTracks();

            // removeEventListener because when we set the activeTracks, the event
            // handleTracksChange fires and it enters in loop.
            audioTracks.removeEventListener('change', this.changeHandler);
            textTracks.removeEventListener('change', this.changeHandler);

            audioTracks.tracks_.forEach(function (t) {
                if (activeTrackIds.indexOf(t.id) > -1) {
                    t.enabled = true;
                } else {
                    t.enabled = false;
                }
            });

            textTracks.tracks_.forEach(function (t) {
                if (activeTrackIds.indexOf(t.id) > -1) {
                    t.mode = 'showing';
                } else {
                    t.mode = 'disabled';
                }
            });

            audioTracks.addEventListener('change', this.changeHandler);
            textTracks.addEventListener('change', this.changeHandler);
        }
    }, {
        key: 'onTrackSuccess',
        value: function onTrackSuccess() {
            return _videoJs2['default'].log('track added');
        }
    }, {
        key: 'onTrackError',
        value: function onTrackError(e) {
            return _videoJs2['default'].log('Cast track Error: ' + JSON.stringify(e));
        }
    }, {
        key: 'castError',
        value: function castError(e) {
            return _videoJs2['default'].log('Cast Error: ' + JSON.stringify(e));
        }
    }, {
        key: 'play',
        value: function play() {
            if (!this.apiMedia) {
                return;
            }
            if (this.paused_) {
                this.apiMedia.play(null, this.mediaCommandSuccessCallback.bind(this, 'Playing: ' + this.apiMedia.sessionId), this.castError.bind(this));
            }
            return this.paused_ = false;
        }
    }, {
        key: 'pause',
        value: function pause() {
            if (!this.apiMedia) {
                return;
            }
            if (!this.paused_) {
                this.apiMedia.pause(null, this.mediaCommandSuccessCallback.bind(this, 'Paused: ' + this.apiMedia.sessionId), this.castError.bind(this));
                return this.paused_ = true;
            }
        }
    }, {
        key: 'paused',
        value: function paused() {
            return this.paused_;
        }
    }, {
        key: 'ended',
        value: function ended() {
            return chrome.cast.media.IdleReason === "FINISHED";
        }
    }, {
        key: 'currentTime',
        value: function currentTime() {
            if (!this.apiMedia) {
                return 0;
            }
            return this.apiMedia.getEstimatedTime();
        }
    }, {
        key: 'setCurrentTime',
        value: function setCurrentTime(position) {

            if (!this.apiMedia) {
                return 0;
            }
            var request = undefined;
            request = new chrome.cast.media.SeekRequest();
            request.currentTime = position;
            //if (this.player_.controlBar.progressControl.seekBar.videoWasPlaying) {
            //  request.resumeState = chrome.cast.media.ResumeState.PLAYBACK_START;
            //}
            return this.apiMedia.seek(request, this.onSeekSuccess.bind(this, position), this.castError.bind(this));
        }
    }, {
        key: 'onSeekSuccess',
        value: function onSeekSuccess(position) {
            _videoJs2['default'].log('seek success' + position);
        }
    }, {
        key: 'volume',
        value: function volume() {
            return this.volume_;
        }
    }, {
        key: 'duration',
        value: function duration() {
            if (!this.apiMedia) {
                return 0;
            }
            return this.apiMedia.media.duration || Infinity;
        }
    }, {
        key: 'controls',
        value: function controls() {
            return false;
        }
    }, {
        key: 'setVolume',
        value: function setVolume(level) {
            var mute = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

            var request = undefined;
            var volume = undefined;
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
            this.apiMedia.setVolume(request, this.mediaCommandSuccessCallback.bind(this, 'Volume changed'), this.castError.bind(this));
            return this.trigger('volumechange');
        }
    }, {
        key: 'mediaCommandSuccessCallback',
        value: function mediaCommandSuccessCallback(information) {
            _videoJs2['default'].log(information);
        }
    }, {
        key: 'muted',
        value: function muted() {
            return this.muted_;
        }
    }, {
        key: 'setMuted',
        value: function setMuted(muted) {
            return this.setVolume(this.volume_, muted);
        }
    }, {
        key: 'supportsFullScreen',
        value: function supportsFullScreen() {
            return false;
        }
    }, {
        key: 'resetSrc_',
        value: function resetSrc_(callback) {
            callback();
        }
    }, {
        key: 'dispose',
        value: function dispose() {
            this.resetSrc_(Function.prototype);
            _get(Object.getPrototypeOf(Chromecast.prototype), 'dispose', this).call(this, this);
        }
    }]);

    return Chromecast;
})(Tech);

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

    var dashTypeRE = /^application\/(?:dash\+xml|(x-|vnd\.apple\.)mpegurl)/i;
    var dashExtRE = /^video\/(mpd|mp4|webm|m3u8)/i;

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
Chromecast.nativeSourceHandler.dispose = function () {};

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

_videoJs2['default'].options.chromecast = {};

Tech.registerTech('Chromecast', Chromecast);

exports['default'] = Chromecast;
module.exports = exports['default'];