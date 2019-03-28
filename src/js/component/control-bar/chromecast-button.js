/**
 * @file chromecast-button.js
 */
import videojs from 'video.js';

const Component = videojs.getComponent('Component');
const ControlBar = videojs.getComponent('ControlBar');
const Button = videojs.getComponent('Button');
let hasReceiver = false;

/**
 * The base class for buttons that toggle chromecast video
 *
 * @param {Player|Object} player
 * @param {Object=} options
 * @extends Button
 * @class ChromeCastButton
 */
class ChromeCastButton extends Button {

    constructor (player, options) {
        options.appId = player.options_.chromecast.appId;
        options.metadata = player.options_.chromecast.metadata;

        super(player, options);
        this.hide();
        this.initializeApi();
        player.chromecast = this;
        this.customData = {}

        this.on(player, 'loadstart', () => {
          if (this.casting && this.apiInitialized) {
            this.onSessionSuccess(this.apiSession);
          }
        });

        this.on(player, 'dispose', () => {
          if (this.casting && this.apiSession) {
            this.apiSession.stop(null, null);
          }
        });
    }

    /**
     * Init chromecast sdk api
     *
     * @method initializeApi
     */

    initializeApi () {
        let apiConfig;
        let appId;
        let sessionRequest;

        let user_agent = window.navigator && window.navigator.userAgent || ''
        let is_chrome = videojs.browser.IS_CHROME || (/CriOS/i).test(user_agent)
        if (!is_chrome || videojs.browser.IS_EDGE || typeof chrome === 'undefined') {
            return;
        }
        if (!chrome.cast || !chrome.cast.isAvailable) {
            videojs.log('Cast APIs not available');
            if (this.tryingReconnect < 10) {
                this.setTimeout(this.initializeApi, 1000);
                ++this.tryingReconnect;
            }
            videojs.log('Cast APIs not available. Max reconnect attempt');
            return;
        }

        videojs.log('Cast APIs are available');
        appId = this.options_.appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
        sessionRequest = new chrome.cast.SessionRequest(appId);
        apiConfig = new chrome.cast.ApiConfig(sessionRequest, ::this.sessionJoinedListener, ::this.receiverListener);
        return chrome.cast.initialize(apiConfig, ::this.onInitSuccess, ::this.castError);
    }

    castError (castError) {

        let error = {
            code: castError.code,
            message: castError.description
        };

        switch (castError.code) {
            case chrome.cast.ErrorCode.API_NOT_INITIALIZED:
            case chrome.cast.ErrorCode.EXTENSION_MISSING:
            case chrome.cast.ErrorCode.EXTENSION_NOT_COMPATIBLE:
            case chrome.cast.ErrorCode.INVALID_PARAMETER:
            case chrome.cast.ErrorCode.LOAD_MEDIA_FAILED:
            case chrome.cast.ErrorCode.RECEIVER_UNAVAILABLE:
            case chrome.cast.ErrorCode.SESSION_ERROR:
            case chrome.cast.ErrorCode.CHANNEL_ERROR:
            case chrome.cast.ErrorCode.TIMEOUT:
                this.addClass('error');
                break;
            case chrome.cast.ErrorCode.CANCEL:
                break;
            default:
                this.player_.error(error);
                break;
        }
        return videojs.log('Cast Error: ' + (JSON.stringify(castError)));
    }

    onInitSuccess () {
        if (hasReceiver) {
            this.show();
        } else {
            this.hide();
        }
        return this.apiInitialized = true;
    }

    sessionJoinedListener (session) {
        if (session.media.length) {
            this.apiSession = session;
            this.onMediaDiscovered(session.media[0]);
        }
        return console.log('Session joined');
    }

    receiverListener (availability) {
        if (availability === 'available') {
            hasReceiver = true;
            return this.show();
        } else {
            hasReceiver = false;
            return this.hide();
        }
    }

    doLaunch () {
        videojs.log('Cast video: ' + (this.player_.cache_.src));
        if (this.apiInitialized) {
            return chrome.cast.requestSession(::this.onSessionSuccess, ::this.castError);
        } else {
            return videojs.log('Session not initialized');
        }
    }

    onSessionSuccess (session) {
        let image;
        let key;
        let loadRequest;
        let mediaInfo;
        let ref;
        let value;


        this.apiSession = session;
        const source = this.player_.cache_.source;
        const type = this.player_.currentType();

        videojs.log('Session initialized: ' + session.sessionId + ' source : ' + source + ' type : ' + type);

        mediaInfo = new chrome.cast.media.MediaInfo(source.src, source.type);

        //TOODO: esto hay que sacarlo porque se va a hacer el consume desde el receiver !, se deja para test tmp
        if (source.keySystemOptions) {
          mediaInfo.customData = source.keySystemOptions[0];
        }

        if (this.customData) {
          mediaInfo.customData = {...mediaInfo.customData, ...this.customData}
        }

        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        if (this.options_.metadata) {
            ref = this.options_.metadata;
            for (key in ref) {
                value = ref[key];
                mediaInfo.metadata[key] = value;
            }

        }
        //Add poster image on player
        const poster = this.player().poster();
        if (poster) {
            image = new chrome.cast.Image(poster);
            mediaInfo.metadata.images = [image];
        }

        // mediaInfo.textTrackStyle = new chrome.cast.media.TextTrackStyle();
        // mediaInfo.textTrackStyle.foregroundColor = '#FFFFFF';
        // mediaInfo.textTrackStyle.backgroundColor = '#00000000';
        // mediaInfo.textTrackStyle.edgeType = chrome.cast.media.TextTrackEdgeType.DROP_SHADOW;
        // mediaInfo.textTrackStyle.windowType = chrome.cast.media.TextTrackWindowType.ROUNDED_CORNERS;

        // Request load media source
        loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);

        loadRequest.autoplay = true;
        loadRequest.currentTime = this.player_.currentTime();

        this.apiSession.loadMedia(loadRequest, ::this.onMediaDiscovered, ::this.castError);
        this.apiSession.addUpdateListener(::this.onSessionUpdate);
    }

    onMediaDiscovered (media) {

      this.oldTech = this.player_.techName_
      this.oldSrc = this.player_.currentSource()

        this.player_.loadTech_('Chromecast', {
            type: 'cast',
            apiMedia: media,
            apiSession: this.apiSession
        });


        this.casting = true;
        this.inactivityTimeout = this.player_.options_.inactivityTimeout;
        this.player_.options_.inactivityTimeout = 0;
        this.player_.userActive(true);
        this.addClass('connected');
        this.removeClass('error');
    }

    onSessionUpdate (isAlive) {
        if (!this.player_.apiMedia) {
            return;
        }
        if (!isAlive) {
            return this.onStopAppSuccess();
        }
    }

    stopCasting () {
        return this.apiSession.stop(::this.onStopAppSuccess, ::this.castError);
    }

    onStopAppSuccess () {
        let paused = this.player_.paused();
        let time = this.player_.currentTime();
        this.casting = false;
        this.player_.loadTech_(this.oldTech);
        this.removeClass('connected');
        this.player_.src(this.oldSrc);
        if (!paused) {
            this.player_.one('seeked', function () {
                return this.player_.play();
            });
        }
        this.player_.currentTime(time);
        this.player_.options_.inactivityTimeout = this.inactivityTimeout;
        this.player_.trigger('seeked');
        return this.apiSession = null;
    }

    /**
     * Allow sub components to stack CSS class names
     *
     * @return {String} The constructed class name
     * @method buildCSSClass
     */
    buildCSSClass () {
        return `vjs-chromecast-button ${super.buildCSSClass()}`;
    }

    /**
     * Handle click on mute
     * @method handleClick
     */
    handleClick (customData) {
        super.handleClick(customData);
        this.customData = customData
        if (this.casting) {
            return this.stopCasting();
        } else {
            return this.doLaunch();
        }
    }
}

ChromeCastButton.prototype.tryingReconnect = 0;

ChromeCastButton.prototype.inactivityTimeout = 2000;

ChromeCastButton.prototype.controlText_ = 'Chromecast';

//Replace videojs CaptionButton child with this one
ControlBar.prototype.options_.children.splice(ControlBar.prototype.options_.children.length - 1, 0, 'chromeCastButton');

Component.registerComponent('ChromeCastButton', ChromeCastButton);
export default ChromeCastButton;
