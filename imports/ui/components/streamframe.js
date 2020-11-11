import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { Session } from 'meteor/session';
import _ from 'lodash';
import './streamframe.html';
import { Projects } from '../../api/projects';
import { setClientVar } from '../utils/clientVar.js';
import { getSecondsFromFormattedTime, getFormattedTimeFromSeconds } from '../utils/timeFormatting';

function getBestWidth(videoCount, containerWidth, containerHeight) {
    let heightNowIfFullWidth = (containerWidth * videoCount / 16) * 9;
    let resultWidth = containerWidth;

    if (heightNowIfFullWidth > containerHeight) {
        resultWidth = (containerHeight / videoCount) / 9 * 16;

        if (resultWidth < containerWidth / 2 && videoCount > 1) {
            return getBestWidth(Math.ceil(videoCount / 2), containerWidth / 2 - 0.1, containerHeight);
        }
    }

    return resultWidth;
}

function processResize() {
    const videoCount = $(".video").length;
    if (videoCount === 0)
        return;

    const container = $("#vidcontainer");
    const containerHeight = container.height();
    const containerWidth = container.outerWidth();
    const bestWidth = getBestWidth(videoCount, containerWidth, containerHeight);

    $(".video").width(bestWidth);
}

function calculateMaxVideoDuration() {
    const videos = Template.currentData().videos;
    let maxVideoDuration = Math.max.apply(null, $("video").map(function (i, element) {
        let duration = element.duration;
        if (isNaN(duration))
            return 0;

        const index = $(element).attr('data-index');
        duration -= videos[index].offset;

        return duration;
    }));
    return maxVideoDuration;
}

function calculateMaxVideoPosition() {
    const videos = Template.currentData().videos;
    let maxVideoPosition = Math.max.apply(null, $("video").map(function (i, element) {
        let position = element.currentTime;
        if (isNaN(position))
            return 0;

        const index = $(element).attr('data-index');
        position -= videos[index].offset;

        return position;
    }));
    return maxVideoPosition;
}

function updateIndicator(context) {
    const timeBar = $("#timebar")[0];
    const timeBarText = $("#timetext")[0];
    const percent = context.streamPos / context.streamDuration * 100;
    // https://stackoverflow.com/a/57153340

    timeBar.style.background = `linear-gradient(to right, rgb(0, 220, 0) 0%, rgb(0, 220, 0) ${percent}%, #fff ${percent}%, #fff 100%)`;
    if (context.streamPos && context.streamDuration) {
        timeBarText.innerText = `${getFormattedTimeFromSeconds(context.streamPos)} / ${getFormattedTimeFromSeconds(context.streamDuration)}`;
    } else {
        timeBarText.innerText = '';
    }
}

function setVideoPosition(pos, context) {
    if (!setVideoPositionWithoutStreamSeek(pos, context))
        return;

    // If video desyncing occurs, maybe it'd be wise to stop each video, position them, and then restart
    // It would be annoying for +1 or +5 skips though, as there will be more lag
    $("video").each(function (index) {
        synchronizeVideo(this, index, context);
    });
}

function setVideoPositionWithoutStreamSeek(pos, context) {
    if (!context.streamDuration) // no stream initialized
        return false;

    context.streamPos = Math.min(pos, context.streamDuration);
    const posSec = Math.floor(pos);
    setClientVar("streamframe.pos" + Session.get("projectId"), posSec);
    updateIndicator(context);
    return true;
}

function synchronizeVideo(video, index, context) {
    video.currentTime = context.videos[index].offset + context.streamPos;
}

function getCursorYPercentInContainer(e) {
    const parentPos = $("#streamcontainer")[0].getBoundingClientRect();
    return cursorPercent = (e.pageY - parentPos.y) / parentPos.height;
}

function getControlsYPercentInContainer() {
    const parentPos = $("#streamcontainer")[0].getBoundingClientRect();
    return $("#vidcontrols").position().top / parentPos.height;
}

Template.streamframe.onCreated(function () {
    Tracker.autorun(function () {
        Session.get('views.resize'); // this allows other components to cause a 'processResize' if some manual parent resizing occured
        processResize();
    });
});

Template.streamframe.onRendered(function () {
    setTimeout(processResize, 0);
    $(window).resize(_.debounce(processResize, 64)); // On 64ms pause in resizing, recalculate layout
});

Template.streamframe.onDestroyed(function () {
    $(window).off('resize', processResize);
});

Template.streamframe.events({
    'mousedown #vidcontrols'(e) {
        this.isDraggingControls = true;
        this.dragPercentStart = getCursorYPercentInContainer(e);
    },
    'mousemove'(e) {
        if (this.isDraggingControls) {
            const yPercent = getCursorYPercentInContainer(e);
            const controls = $("#vidcontrols");
            const diffY = yPercent - this.dragPercentStart;
            const newY = _.clamp(getControlsYPercentInContainer() * 100 + diffY * 100, 0, 95);

            controls.css('top', `${newY}%`);
            this.dragPercentStart = yPercent;
        }
    },
    'mouseup'(e) {
        this.isDraggingControls = false;
    },
    'click #plus1sec'() {
        setVideoPosition(this.streamPos + 1, this);
    },
    'click #plus5sec'() {
        setVideoPosition(this.streamPos + 5, this);
    },
    'click #minus1sec'() {
        setVideoPosition(this.streamPos - 1, this);
    },
    'click #minus5sec'() {
        setVideoPosition(this.streamPos - 5, this);
    },
    'click #playPause'() {
        const func = this.isPlaying ? 'pause' : 'play';
        $("video").each(function () {
            this[func]();
        });

        this.isPlaying = !this.isPlaying;

        const playPauseBtn = $("#playPause");
        if (this.isPlaying) {
            playPauseBtn.removeClass("btn-success");
            playPauseBtn.addClass("btn-warning");
            playPauseBtn.text("Pause");
        } else {
            playPauseBtn.addClass("btn-success");
            playPauseBtn.removeClass("btn-warning");
            playPauseBtn.text("Play");
        }
    },
    'timeupdate video'() {
        setVideoPositionWithoutStreamSeek(calculateMaxVideoPosition(), this);
    },
    'loadedmetadata'() {
        this.streamDuration = calculateMaxVideoDuration();
        setClientVar("streamframe.duration" + Session.get("projectId"), this.streamDuration);
        updateIndicator(this);
    },
    'error video'(event) {
        $(event.target).next().show();
    },
    'click .resolve'(event) {
        var fileDialog = document.createElement('input');
        fileDialog.type = 'file';

        fileDialog.onchange = diag => {
            const video = $("video[data-index=" + event.target.attributes['data-index'].value + "]");
            const newFile = diag.target.files[0];
            const newFileUrl = URL.createObjectURL(newFile);

            video.next().hide();
            video.attr("src", newFileUrl);
        };

        fileDialog.click();
    },
    'click video'() {
        $("#vidcontext").hide(); // hide contextmenu if clicking besides it
    },
    'contextmenu .vidoverlay'(e) {
        e.preventDefault();
    },
    'contextmenu video'(event) {
        event.preventDefault();

        const streamcontainer = $("#streamcontainer")[0];
        const streamcontainerPos = streamcontainer.getBoundingClientRect();
        const contextMenu = $("#vidcontext");
        const videoIndex = $(event.target).attr("data-index");
        const videoData = this.videos[videoIndex];
        const video = $("video[data-index=" + videoIndex + "]")[0];

        if (video.readyState === 0)
            return;

        $("#ctx-title").text(videoData.name);
        $("#ctx-offset").text(videoData.offset);
        $("#ctx-sound").val(video.muted ? 0 : video.volume);

        contextMenu.attr('data-video', videoIndex);
        contextMenu.css('left', event.pageX - streamcontainerPos.x);
        contextMenu.css('top', event.pageY - streamcontainerPos.y);
        contextMenu.toggle();
    },
    'change #ctx-offset'(event) {
        const contextMenu = $("#vidcontext");
        const videoIndex = contextMenu.attr('data-video');
        const newOffset = Number(event.target.value);

        if (isNaN(newOffset) || newOffset === undefined)
            return;

        this.videos[videoIndex].offset = newOffset;
        synchronizeVideo($("video[data-index=" + videoIndex + "]")[0], videoIndex, this);
    },
    'change #ctx-sound'(event) {
        const contextMenu = $("#vidcontext");
        const videoIndex = contextMenu.attr('data-video');
        const video = $("video[data-index=" + videoIndex + "]")[0];
        const volume = event.target.value;

        video.volume = volume;
        if (video.volume > 0 && video.muted)
            video.muted = false;
    },
    'click #ctx-mute'(event) {
        const contextMenu = $("#vidcontext");
        const videoIndex = contextMenu.attr('data-video');
        const video = $("video[data-index=" + videoIndex + "]")[0];

        video.muted = !video.muted;

        if (video.muted) {
            $("#ctx-sound").val(0);
        } else {
            $("#ctx-sound").val(video.volume);
        }
    },
    'click #timebar'(event) {
        const boundingRect = event.target.getBoundingClientRect();
        const x = event.pageX - boundingRect.x;
        const percent = x / boundingRect.width;

        setVideoPosition(this.streamDuration * percent, this);
    }
});
