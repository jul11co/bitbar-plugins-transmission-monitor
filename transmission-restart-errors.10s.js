#!/usr/bin/env node

// <bitbar.title>Transmission Monitor</bitbar.title>
// <bitbar.author>Jul11Co</bitbar.author>
// <bitbar.author.github>Jul11Co</bitbar.author.github>
// <bitbar.desc>Monitor Tranmission torrent downloads</bitbar.desc>
// <bitbar.dependencies>node</bitbar.desc>

// To install
// npm install async bytes transmission 

var async = require('async');
var bytes = require('bytes');

var Transmission = require('transmission');

var transmission = new Transmission({
  host: '192.168.11.107',        // default: 'localhost'
  port: 9091,                    // default: 9091
  username: 'transmission',      // default: blank
  password: '12345678'           // default: blank
});

// Get torrent state 
function getStatusType(type){
  if(type === 0){
    return 'STOPPED';
  } else if(type === 1){
    return 'CHECK_WAIT';
  } else if(type === 2){
    return 'CHECK';
  } else if(type === 3){
    return 'DOWNLOAD_WAIT';
  } else if(type === 4){
    return 'DOWNLOAD';
  } else if(type === 5){
    return 'SEED_WAIT';
  } else if(type === 6){
    return 'SEED';
  } else if(type === 7){
    return 'ISOLATED';
  }
  // return transmission.statusArray[type]
}

function trimText(input, max_length) {
  if (!input || input == '') return '';
  max_length = max_length || 60;
  var output = input.trim();
  if (output.length > max_length) {
    output = output.substring(0, max_length) + '...';
  }
  return output;
}

function getAllTorrents(options, callback){
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function(err) {};

  transmission.get(function(err, result){
    if (err){
      return callback(err);
    }
    else {
      if (result) return callback(null, result.torrents || []);
      else return callback(new Error('Invalid result'));
    }
  });
}

// To start a paused / stopped / error torrent which is still in queue 
function startTorrent(id, options, callback){
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function(err) {};

  // start
  transmission.start(id, function(err, result){
    if (err){
      return callback(err);
    }
    setTimeout(function() {
      // recheck
      transmission.get(id, function(err, result) {
        if (err){
          return callback(err);
        }
        else if (result.torrents && result.torrents.length) {
          if (result.torrents[0].status == 3 || result.torrents[0].status == 4) {
            // Torrent started
          }
        }
        return callback();
      });
    }, 2000);
  });
}

// To start a paused / stopped / error torrent which is still in queue 
function startTorrentNow(id, options, callback){
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function(err) {};

  // start
  transmission.startNow(id, function(err, result){
    if (err){
      return callback(err);
    }
    setTimeout(function() {
      // recheck
      transmission.get(id, function(err, result) {
        if (err){
          // console.log(err);
          return callback(err);
        }
        else if (result.torrents && result.torrents.length) {
          if (result.torrents[0].status == 3 || result.torrents[0].status == 4) {
            // Torrent started
          }
        }
        return callback();
      });
    }, 2000);
  });
}

function restartErrorTorrents(torrents, callback) {
  
  var error_torrents = torrents.filter(function(torrent) {
    return (torrent.status == 0 && torrent.error);
  });
  if (error_torrents.length == 0) {
    return callback();
  }

  async.eachSeries(error_torrents, function(torrent, cb) {
    // start error torrent
    startTorrent(torrent.id, function(err) {
      cb(err);
    });
  }, function(err) {
    callback(err);
  });
}

function update(done) {
  // get all torrents
  getAllTorrents(function(err, torrents) {
    if (err) {
      // console.log(err);
      return done(err);
    } else if (!torrents || torrents.length == 0) {
      console.log("🐶");console.log('---');
      console.log('No torrents | color=black');
      return done();
    }

    var torrent_stats = {};
    torrents.forEach(function(torrent) {
      if (torrent.status >= 0  && torrent.status <= 7) {
        var status = getStatusType(torrent.status);
        torrent_stats[status] = torrent_stats[status] || [];
        torrent_stats[status].push(torrent);
      }
    });

    var downloading = torrent_stats['DOWNLOAD'] ? torrent_stats['DOWNLOAD'].length : 0;
    var seeding = torrent_stats['SEED'] ? torrent_stats['SEED'].length : 0;
    console.log("🐶 " + downloading + '/' + seeding);console.log('---');

    for (var status in torrent_stats) {
      console.log(status + ': ' + torrent_stats[status].length + '');
      torrent_stats[status].forEach(function(torrent) {
        var percentage = (torrent.percentDone*100).toFixed(1);
        console.log('--[' + bytes(torrent.totalSize) + '] ' + percentage + '% ' 
          + trimText(torrent.name,30) + ' | color=black');
      });
      // console.log('---');
    }
    console.log('---');

    var active_torrents = torrents.filter(function(torrent) {
      return (torrent.status >= 3 && torrent.status <= 6);
    });

    active_torrents.sort(function(a,b) {
      if (a.percentDone>b.percentDone) return -1;
      if (a.percentDone<b.percentDone) return 1;
      return 0;
    });

    active_torrents.forEach(function(torrent) {
      var percentage = (torrent.percentDone*100).toFixed(1);
      if (torrent.status == 3 && torrent.error) {
        console.log('⏸ ' + bytes(torrent.totalSize) + ' ' + percentage + '% ' 
          + trimText(torrent.name,30) + ' | color=red');
        console.log(' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
        console.log("Error: "+ trimText(torrent.errorString,40) + ' | color=grey');
      }
      else if (torrent.status == 3) {
        console.log('⏸ ' + trimText(torrent.name,30) + ' | color=orange');
        console.log(' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
      } 
      else if (torrent.status == 4) {
        console.log('⏬ ' + trimText(torrent.name,30) + ' | color=blue');
        console.log(' ' + bytes(torrent.totalSize) + ', ' + percentage + '%, ' 
          + " ▼ " + bytes(torrent.rateDownload) + '/s, ▲ ' + bytes(torrent.rateUpload) + '/s | color=grey');
      }
      else if (torrent.status == 6) {
        console.log('⏫ ' + trimText(torrent.name,30) + ' | color=green');
        console.log(' ' + bytes(torrent.totalSize) + ', ' + percentage + '%, ' 
          + " ▼ " + bytes(torrent.rateDownload) + '/s, ▲ ' + bytes(torrent.rateUpload) + '/s | color=grey');
      }
      else if (torrent.status == 5) {
        console.log('⏸ ' + trimText(torrent.name,30) + ' | color=green');
        console.log(' ' + bytes(torrent.totalSize) + ', ' + percentage + '% | color=grey');
      }
      console.log('---');
    });

    // Restart error torrents
    restartErrorTorrents(torrents, done);
  });
}

update(function(err) {});

