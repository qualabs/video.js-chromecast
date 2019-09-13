/**
 * @file chromecast-button.js
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _videoJs = require('video.js');

var _videoJs2 = _interopRequireDefault(_videoJs);

var Component = _videoJs2['default'].getComponent('Component');
var ControlBar = _videoJs2['default'].getComponent('ControlBar');
var Button = _videoJs2['default'].getComponent('Button');

/**
 * The base class for buttons that toggle chromecast video
 *
 * @param {Player|Object} player
 * @param {Object=} options
 * @extends Button
 * @class ChromeCastButton
 */

var ChromeCastButton = (function (_Button) {
    _inherits(ChromeCastButton, _Button);

    function ChromeCastButton(player, options) {
        var _this = this;

        _classCallCheck(this, ChromeCastButton);

        options.appId = player.options_.chromecast.appId;
        options.receiverListener = player.options_.chromecast.receiverListener;
        options.autoJoinPolicy = player.options_.chromecast.autoJoinPolicy;
        options.metadata = player.options_.chromecast.metadata;

        _get(Object.getPrototypeOf(ChromeCastButton.prototype), 'constructor', this).call(this, player, options);
        this.oldTech = 'Html5';
        this.hide();
        this.initializeApi();
        player.chromecast = this;
        this.customData = {};
        this.hasReceiver = false;

        this.on(player, 'loadstart', function () {
            if (_this.casting && _this.apiInitialized) {
                _this.onSessionSuccess(_this.apiSession);
            }
        });

        this.on(player, 'dispose', function () {
            if (_this.casting && _this.apiSession) {
                _this.apiSession.stop(null, null);
            }
        });
    }

    /**
     * Init chromecast sdk api
     *
     * @method initializeApi
     */

    _createClass(ChromeCastButton, [{
        key: 'initializeApi',
        value: function initializeApi() {
            var apiConfig = undefined;
            var appId = undefined;
            var autoJoinPolicy = undefined;
            var sessionRequest = undefined;

            //        let user_agent = window.navigator && window.navigator.userAgent || ''
            //        let is_chrome = videojs.browser.IS_CHROME || (/CriOS/i).test(user_agent)
            //        if (!is_chrome || videojs.browser.IS_EDGE || typeof chrome === 'undefined') {
            //            return;
            //        }
            var chrome = window.chrome;

            if (!chrome || !chrome.cast || !chrome.cast.isAvailable) {
                _videoJs2['default'].log('Cast APIs not available');
                if (this.tryingReconnect < 10) {
                    this.setTimeout(this.initializeApi, 1000);
                    ++this.tryingReconnect;
                }
                _videoJs2['default'].log('Cast APIs not available. Max reconnect attempt');
                return;
            }

            _videoJs2['default'].log('Cast APIs are available');
            appId = this.options_.appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
            autoJoinPolicy = this.options_.autoJoinPolicy || chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED;
            sessionRequest = new chrome.cast.SessionRequest(appId);
            apiConfig = new chrome.cast.ApiConfig(sessionRequest, this.sessionJoinedListener.bind(this), this.receiverListener.bind(this), autoJoinPolicy);
            return chrome.cast.initialize(apiConfig, this.onInitSuccess.bind(this), this.castError.bind(this));
        }
    }, {
        key: 'castError',
        value: function castError(_castError) {

            var error = {
                code: _castError.code || _castError.message,
                message: _castError.description
            };

            switch (error.code) {
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
            return _videoJs2['default'].log('Cast Error: ' + JSON.stringify(_castError));
        }
    }, {
        key: 'onInitSuccess',
        value: function onInitSuccess() {
            if (this.hasReceiver) {
                this.show();
            } else {
                this.hide();
            }
            return this.apiInitialized = true;
        }
    }, {
        key: 'sessionJoinedListener',
        value: function sessionJoinedListener(session) {
            if (session.media.length) {
                this.apiSession = session;
                this.apiSession.addUpdateListener(this.onSessionUpdate.bind(this));
                this.joinCastSession(session.media[0]);
            }
            return console.log('Session joined');
        }
    }, {
        key: 'receiverListener',
        value: function receiverListener(availability) {
            if (availability === 'available') {
                this.hasReceiver = true;
                this.options_.receiverListener(true);
                return this.show();
            } else {
                this.hasReceiver = false;
                this.options_.receiverListener(false);
                return this.hide();
            }
        }
    }, {
        key: 'doLaunch',
        value: function doLaunch(customData) {
            this.customData = customData;
            _videoJs2['default'].log('Cast video: ' + this.player_.cache_.src);
            if (this.apiInitialized) {
                if (this.casting) {
                    return this.onSessionSuccess(this.apiSession);
                } else {
                    return chrome.cast.requestSession(this.onSessionSuccess.bind(this), this.castError.bind(this));
                }
            } else {
                return _videoJs2['default'].log('Session not initialized');
            }
        }
    }, {
        key: 'onSessionSuccess',
        value: function onSessionSuccess(session) {
            var image = undefined;
            var key = undefined;
            var loadRequest = undefined;
            var mediaInfo = undefined;
            var ref = undefined;
            var value = undefined;

            this.apiSession = session;
            var source = this.player_.cache_.source || { src: 'casting', type: '' };
            var type = this.player_.currentType();

            _videoJs2['default'].log('Session initialized: ' + session.sessionId + ' source : ' + source + ' type : ' + type);

            mediaInfo = new chrome.cast.media.MediaInfo(source.src, source.type);

            if (this.customData) {
                mediaInfo.customData = _extends({}, mediaInfo.customData, this.customData);
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
            var poster = this.player().poster();
            if (poster) {
                image = new chrome.cast.Image(poster);
                mediaInfo.metadata.images = [image];
            }

            mediaInfo.textTrackStyle = new chrome.cast.media.TextTrackStyle();
            mediaInfo.textTrackStyle.foregroundColor = '#FFFFFF';
            mediaInfo.textTrackStyle.backgroundColor = '#00000001';
            mediaInfo.textTrackStyle.edgeType = chrome.cast.media.TextTrackEdgeType.DEPRESSED;
            mediaInfo.textTrackStyle.windowType = chrome.cast.media.TextTrackWindowType.ROUNDED_CORNERS;

            // Request load media source
            loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);

            loadRequest.autoplay = true;
            loadRequest.currentTime = this.player_.currentTime();

            // Force to JS to make a deep copy of String
            // this.oldTech = (' ' + this.player_.techName_).slice(1)
            this.oldSrc = this.player_.currentSource();

            this.apiSession.loadMedia(loadRequest, this.onMediaDiscovered.bind(this), this.castError.bind(this));
            this.apiSession.addUpdateListener(this.onSessionUpdate.bind(this));
        }
    }, {
        key: 'onMediaDiscovered',
        value: function onMediaDiscovered(media, isAutoJoined) {
            if (!isAutoJoined) {
                isAutoJoined = false;
            }

            this.player_.loadTech_('Chromecast', {
                type: 'cast',
                apiMedia: media,
                apiSession: this.apiSession
            });

            this.player_.cache_.source = { src: media.media.contentId };
            this.casting = true;
            this.inactivityTimeout = this.player_.options_.inactivityTimeout;
            this.player_.options_.inactivityTimeout = 0;
            this.player_.userActive(true);
            this.player_.trigger('castConnected', isAutoJoined);
            this.addClass('connected');
            this.removeClass('error');
        }
    }, {
        key: 'onSessionUpdate',
        value: function onSessionUpdate(isAlive) {
            if (!isAlive) {
                return this.onStopAppSuccess();
            }

            if (this.apiMedia != this.apiSession.media[0]) {
                this.joinCastSession(this.apiSession.media[0]);
            }
        }
    }, {
        key: 'joinCastSession',
        value: function joinCastSession(media) {
            // Force to JS to make a deep copy of String
            // this.oldTech = (' ' + this.player_.techName_).slice(1);
            this.oldSrc = this.player_.currentSource();

            var isAutoJoined = true;
            this.onMediaDiscovered(media, isAutoJoined);
        }
    }, {
        key: 'stopCasting',
        value: function stopCasting() {
            var ret = this.apiSession.stop(this.onStopAppSuccess.bind(this), this.castError.bind(this));

            if (this.apiSession.status === 'stopped') {
                this.onStopAppSuccess();
            }

            return ret;
        }
    }, {
        key: 'onStopAppSuccess',
        value: function onStopAppSuccess() {
            var paused = this.player_.paused();
            var time = this.player_.currentTime();
            var duration = this.player_.duration();

            this.casting = false;
            this.player_.loadTech_(this.oldTech);
            this.removeClass('connected');
            /*
            Se comenta debido a que en nuestro caso no aplica ya que debemos hacer
            conusme cada vez que queremos reproducir un contenido. @Emil, si queres
            pushear al repo de benji hay que descomentar para que sea reutilizable.
            */
            // this.player_.src(this.oldSrc);

            if (!paused) {
                this.player_.one('seeked', function () {
                    return this.player_.play();
                });
            }

            // Detect if the current stream is a Live Stream
            if (duration && !isNaN(duration) && duration !== Infinity) {
                this.player_.currentTime(time);
                this.player_.trigger('seeked');
            }

            this.player_.options_.inactivityTimeout = this.inactivityTimeout;
            this.player_.trigger('castDisconnected');
            return this.apiSession = null;
        }

        /**
         * Allow sub components to stack CSS class names
         *
         * @return {String} The constructed class name
         * @method buildCSSClass
         */
    }, {
        key: 'buildCSSClass',
        value: function buildCSSClass() {
            return 'vjs-chromecast-button ' + _get(Object.getPrototypeOf(ChromeCastButton.prototype), 'buildCSSClass', this).call(this);
        }

        /**
         * Handle click on mute
         * @method handleClick
         */
    }, {
        key: 'handleClick',
        value: function handleClick(customData) {
            _get(Object.getPrototypeOf(ChromeCastButton.prototype), 'handleClick', this).call(this, customData);
            if (this.casting) {
                return this.stopCasting();
            } else {
                return this.doLaunch(customData);
            }
        }
    }]);

    return ChromeCastButton;
})(Button);

ChromeCastButton.prototype.tryingReconnect = 0;

ChromeCastButton.prototype.inactivityTimeout = 2000;

ChromeCastButton.prototype.controlText_ = 'Chromecast';

//Replace videojs CaptionButton child with this one
ControlBar.prototype.options_.children.splice(ControlBar.prototype.options_.children.length - 1, 0, 'chromeCastButton');

Component.registerComponent('ChromeCastButton', ChromeCastButton);
exports['default'] = ChromeCastButton;
module.exports = exports['default'];