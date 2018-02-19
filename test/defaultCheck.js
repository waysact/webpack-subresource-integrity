module.exports = function defaultTest(stats, url, browser) {
  return browser.newPage().then(page => {
    var resultPromise = new Promise((resolve, reject) => {
      page.on('console', msg => {
        Promise.all(msg.args().map(arg => arg.jsonValue())).then(args => {
          if (args[0] === 'ok') {
            resolve();
          } else if (args[0] === 'error') {
            reject(new Error(args.slice(1).join(' ')));
          } else {
            process.stderr.write(args.join(' ') + '\n');
          }
        });
      });
    });

    var timeoutPromise = new Promise((resolve, reject) => {
      var wait = setTimeout(() => {
        clearTimeout(wait);
        reject(new Error('Timeout loading page'));
      }, 3000);
    });

    return page
      .goto(url, { waitUntil: 'networkidle0' })
      .then(() => Promise.race([resultPromise, timeoutPromise]));
  });
};
