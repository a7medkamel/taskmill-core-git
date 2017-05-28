"use strict";

var urljoin = require('url-join')
  , Promise = require('bluebird')
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

    let { hostname, pathname } = url_parsed;

    let path_parts = pathname.split(path.sep);

    return {
        username  : path_parts[1]
      , repo      : path.basename(path_parts[2], '.git')
      , hostname  : hostname
      , pathname  : pathname
    };
  }

module.exports = {
    parse         : parse
  , stringify     : stringify
  , remote        : _remote
  , get_platform  : get_platform
  , base_url      : base_url
};
