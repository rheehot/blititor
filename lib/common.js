function destructMarkdown(markdownText) {
    var title = markdownText.toString().match(/^##[^#].+/m)[0].trim();
    var quote = markdownText.toString().match(/^>.+/m)[0].trim();
    var credit = markdownText.toString().match(/^###[^#].*redit(.|\n)*/igm)[0].trim().split('\n');
    console.log(credit.slice(1, 1));

    return {
        title: title.substring(title.indexOf('##') + 2).trim(),
        quote: quote.substring(quote.indexOf('>') + 1).trim(),
        credit: credit.slice(1).join('').trim()
    };
}

function regexFilter() {
    return {
        page: /\/([^\/]+)\/?$/
    };
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(len) {
    var buf = []
        , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        , charlen = chars.length;

    for (var i = 0; i < len; ++i) {
        buf.push(chars[getRandomInt(0, charlen - 1)]);
    }

    return buf.join('');
}
module.exports = {
    destructMarkdown: destructMarkdown,
    regexFilter: regexFilter,
    randomString: randomString,
    testUser: {
        id: 123412341234,
        username: 'soomtong@gmail.com',
        password: '1234'
    }
};