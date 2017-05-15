const request = require('request');
const promisify = require('js-promisify');
const SourceCore = require('proxy-supervisor').SourceCore;
const cheerio = require('cheerio');
const form = require('./form.js');

const protocol = str => (str === 'HTTPS' ? 'https://' : 'http://');

const Source = class Source extends SourceCore {
  constructor({ interval = 5 * 60 * 1000 } = {}) {
    super();

    this.interval = interval;
    this._timeout = null;

    this.start();
  }

  /*
    Use only in case you need to stop monitoring manually.

    Monitor is started automatically on creation and can work
    with empty list of listeners.
  */
  start() {
    if (this._timeout) return;
    if (this.interval < 0) this.interval = 5 * 60 * 1000;

    const self = this;
    function endless() {
      self.load().then(() => {
        if (self._timeout) self._timeout = setTimeout(endless, self.interval);
      });
    }
    this._timeout = setTimeout(endless, this.interval);
  }

  stop() {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = null;
  }

  /*
    Loads new proxies. Returns promise, which resolves into an array of proxies.
  */
  load() {
    const options = { uri: 'http://proxylist.hidemyass.com/', method: 'POST', form, followAllRedirects: true };
    return promisify(request, [options])
      .then((res) => {
        const $ = cheerio.load(res.body);
        const addresses = $('#listable tr')
          .slice(1)
          .map((i, el) => $(el).children('td'))
          .map((i, children) => {
            console.log($($(children[1]).contents()[1]).children(':visible'));
            return protocol($(children[6]).text()) + $(children[1]).contents('span')[0].innerText + ':' + $(children[2]).text().trim();
          })
          .get();

        console.log(addresses);
        if (addresses.length === 0) return [];
        // add them to listeners
        this.listeners.forEach((listener) => {
          listener.add(addresses);
        });

        return addresses;
      });
  }

};

/**
 * Export default singleton.
 *
 * @api public
 */
let instance = null;
module.exports = () => {
  if (instance === null) instance = new Source();
  return instance;
};

/**
 * Expose constructor.
 */
module.exports.Source = Source;
