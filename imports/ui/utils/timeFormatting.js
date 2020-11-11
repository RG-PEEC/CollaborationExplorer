export function getFormattedTimeFromSeconds(sec) {
    sec = Number(sec);
    let h = Math.floor(sec / (60 * 60));
    let m = Math.floor((sec / 60) % 60);
    let s = Math.floor(sec % 60);


    m = ("0" + m).slice(-2);
    s = ("0" + s).slice(-2);

    if (h > 0)
        return `${h}:${m}:${s}`;
    else
        return `${m}:${s}`;
}

export function getSecondsFromFormattedTime(formattedTime) {
    if (!formattedTime || formattedTime === "")
        return 0;

    const timeParts = formattedTime.split(':');
    let sec = Number(timeParts[timeParts.length - 1]);

    if (timeParts.length > 1)
        sec += timeParts[timeParts.length - 2] * 60;
    if (timeParts.length > 2)
        sec += timeParts[timeParts.length - 3] * 60 * 60;

    return sec;
}