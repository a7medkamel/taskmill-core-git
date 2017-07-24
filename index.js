"use strict";

const crypto = require('crypto');

var urljoin = require('url-join')
  , Promise = require('bluebird')
  , winston = require('winston')
  , url     = require('url')
  , path    = require('path')
  , _       = require('lodash')
  , config  = require('config')
  ;

function stringify(platform, username, repository, filename, options = {}) {
  let branch = options.branch || 'master';

  switch(platform) {
    case 'github':
    case 'gitlab':
      return '/' + urljoin(username, repository, 'blob', branch, filename);
    case 'bitbucket':
      return '/' + urljoin(username, repository, 'src', branch, filename);
  };
}

function base_url(remote, pathname) {
  let parsed = _remote(remote);
  let hostname = parsed.hostname;

  let ret = undefined;
  if (_.startsWith(pathname, `/${hostname}`)) {
    ret = parse(undefined, pathname);
  } else {
    ret = parse(hostname, pathname);
  }

  let idx = pathname.lastIndexOf(ret.filename);

  return pathname.substring(0, idx);
}

function get_host_metadata(host) {
  switch(host) {
    case 'github.run':
    case 'www.github.run':
    case 'github.com':
      return {
          regex     : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host      : 'github.com'
        , platform  : 'github'
      }
    case 'gitlab.run':
    case 'www.gitlab.run':
    case 'gitlab.com':
      return {
          regex     : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host      : 'gitlab.com'
        , platform  : 'gitlab'
      };
    case 'bitbucket.run':
    case 'www.bitbucket.run':
    case 'bitbucket.com':
      return {
          // https://bitbucket.run/a7medkamel/bitbucket-breadboard-library/src/ddcf536f37738de175aac84aae8daea265a2d83d/helloworld.js
          regex     : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/src\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host      : 'bitbucket.org'
        , platform  : 'bitbucket'
      };
    default:
      if (config.has(`git.${host}`)) {
        let ret = config.get(`git.${host}`);

        return {
            regex     : new RegExp(ret.regex, 'g')
          , host      : ret.host
          , platform  : ret.platform
        }
      }
  }
}

function get_platform(host) {
  switch(host) {
    case 'github.run':
    case 'www.github.run':
    case 'github.com':
      return 'github';
    case 'gitlab.run':
    case 'www.gitlab.run':
    case 'gitlab.com':
      return 'gitlab';
    case 'bitbucket.run':
    case 'www.bitbucket.run':
    case 'bitbucket.com':
      return 'bitbucket';
    default:
      if (config.has(`git.${host}`)) {
        let ret = config.get(`git.${host}`);

        return ret.platform;
      }
  }
}

function get_remote(platform, host, username, repository) {
  switch(platform) {
    case 'github':
      return urljoin('https://' + host, username, repository + '.git');
    case 'gitlab':
      return urljoin('https://' + host, username, repository + '.git');
    case 'bitbucket':
      // https://a7medkamel@bitbucket.org/a7medkamel/bitbucket-breadboard-library.git
      return `https://${username}@bitbucket.org/${username}/${repository}.git`;
  }
}

function parse(host, pathname) {
  let metadata = get_host_metadata(host);
  if (!metadata) {
    let parsed = url.parse('https://' + pathname.substring(1)); // trim leading /

    metadata = get_host_metadata(parsed.host);
    pathname = pathname.substring(_.size(parsed.host) + 1);
  }

  if (metadata) {
    let match = metadata.regex.exec(pathname);
    if (match) {
      return {
          remote      : get_remote(metadata.platform, metadata.host, match[1], match[2])
        , branch      : match[3]
        , filename    : match[4]
        , uri         : 'https://' + urljoin(metadata.host, match[1], match[2] + '.git#' + match[3]) + '+' + match[4]
        , platform    : metadata.platform
        , owner       : match[1]
        , repository  : match[2]
      };
    } else {
      throw new Error(`not a valid route: ${pathname}`);
    }
  } else {
    throw new Error('unknown host');
  }
}

function _remote(remote) {
  let url_parsed = url.parse(remote);

  let { protocol, hostname, pathname } = url_parsed;

  pathname = path.normalize(pathname);

  let parts =  _.chain(pathname.split(path.sep)).tail().take(2).compact().value();

  if (_.size(parts) != 2) {
    winston.error(`remote parsing error, parts != 2`, remote, parts);
    throw new Error('not found');
  }

  let username  = parts[0]
    , repo      = path.basename(parts[1], '.git')
    ;

  return {
      protocol
    , hostname
    , pathname
    , username
    , repo
  };
}

function normalize(remote) {
  if (_.isString(remote)) {
    remote = _remote(remote);
  }

  let { protocol, hostname, username, repo } = remote;

  repo = _.toLower(repo);
  username = _.toLower(username);

  return {
      username
    , repo
    , remote : url.format({ protocol, hostname, pathname : `${username}/${repo}.git` })
  };
}

function key(remote, options = {}) {
  if (_.isString(remote)) {
    remote = _remote(remote);
  }

  let { remote : normalized, username } = normalize(remote);

  if (options.username) {
    username = _.toLower(options.username);
  }

  return crypto.createHmac('sha256', '').update(`${username}@${normalized}`).digest('hex');
}

function dir(remote, options = {}) {
  if (_.isString(remote)) {
    remote = _remote(remote);
  }

  let { hostname, pathname } = remote;

  return path.join(_.toLower(hostname), _.toLower(pathname));
}

module.exports = {
    parse
  , stringify
  , remote        : _remote
  , get_platform
  , base_url
  , normalize
  , key
  , dir
};
