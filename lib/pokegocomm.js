'use strict';

var request    = require('request');
var ProtoBuf   = require('protobufjs');
var s2         = require('s2');
var builder    = ProtoBuf.loadProtoFile(__dirname + '/protos/POGOProtos.proto');

var pokemonProto = builder.build();

//console.log(pokemonProto.POGOProtos.Networking.equests.RequestType);

var p = pokemonProto.POGOProtos;
var requestType = pokemonProto.POGOProtos.Networking.Requests.RequestType;
var Networking  = pokemonProto.POGOProtos.Networking;
var Request = Networking.Requests.Request;
var RequestEnvelope = p.Networking.Envelopes.RequestEnvelope;
var ResponseEnvelope = p.Networking.Envelopes.ResponseEnvelope;
var Responses = Networking.Responses;
var Messages  = Networking.Requests.Messages;

var api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc';
var login_url = 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize';
var login_oauth = 'https://sso.pokemon.com/sso/oauth2.0/accessToken';

var m = module.exports;

m.apiRequest = function(playerInfo,req,callBack) {
  var api_endpoint = api_url;
  if (typeof playerInfo.apiEndpoint === 'string' && playerInfo.apiEndpoint !== '') {
    api_endpoint = playerInfo.apiEndpoint;
  }

  var tmpRequest = {
    'status_code':   2,
    'request_id': 1469378659230941192,
    'requests':   req,
    'latitude':   playerInfo.latitude,
    'longitude':  playerInfo.longitude,
    'altitude':   playerInfo.altitude,
    'unknown12':  989
  }

  if(playerInfo.auth_ticket) {
    tmpRequest.auth_ticket = playerInfo.auth_ticket;
  } else {
    tmpRequest.auth_info = new RequestEnvelope.AuthInfo({
      'provider': 'ptc',
      'token':    new RequestEnvelope.AuthInfo.JWT({
        'contents': playerInfo.accessToken,
        'unknown2': 59
      })
    });
  }

  var f_ret = new RequestEnvelope(tmpRequest);
  var protobuf = f_ret.encode().toBuffer();

  var options = {
    url: api_endpoint,
    body: protobuf,
    encoding: null,
    headers: {
      'User-Agent': 'Niantic App'
    }
  };
  request.post(options, function(err,resp,body) {
    if(err) return callBack(err);
    if(resp == undefined || body == undefined) return callBack('RPC Server offline');
    try {
      var f_ret = ResponseEnvelope.decode(body);
    } catch (e) {
      return callBack(e);
    }
    if(f_ret.auth_ticket) playerInfo.auth_ticket = f_ret.auth_ticket;
    return callBack(null,f_ret);
  });
}

m.ptcLogin = function(playerInfo,callBack) {
  var requeste = require('request');
  var j = requeste.jar();
  var request = requeste.defaults({ jar: j });

  var options = {
    url: login_url,
    headers: {
      'User-Agent': 'niantic'
    }
  };

  request.get(options, function(err, response, body) {
    if(err) return callBack(err);
    var data = JSON.parse(body);

    options = {
      url: login_url,
      form: {
        'lt'        : data.lt,
        'execution' : data.execution,
        '_eventId'  : 'submit',
        'username'  : playerInfo.username,
        'password'  : playerInfo.password
      },
      headers: {
        'User-Agent': 'niantic'
      }
    };

    request.post(options, function(err, response, body) {
    //Parse body if any exists, callBack with errors if any.
      if(err) {return callBack(err)};
      if (body) {
        var parsedBody = JSON.parse(body);
        if (parsedBody.errors && parsedBody.errors.length !== 0) {
          return callBack({login_errors: + parsedBody.errors});
        }
      }

      var ticket = response.headers['location'].split('ticket=')[1];

      options = {
        url: login_oauth,
        form: {
          'client_id'         : 'mobile-app_pokemon-go',
          'redirect_uri'      : 'https://www.nianticlabs.com/pokemongo/error',
          'client_secret'     : 'w8ScCUXJQc6kXKw8FiOhd8Fixzht18Dq3PEVkUCP5ZPxtgyWsbTvWHFLm2wNY0JR',
          'grant_type'        : 'refresh_token',
          'code'              : ticket
        },
        headers: {
          'User-Agent': 'niantic'
        }
      };

      request.post(options, function(err, response, body) {
        var token = body.split('token=')[1];
        token = token.split('&')[0];
        if (!token) {
          return callBack('Login failed');
        }
        callBack(null, token);
      });
    });
  });
}

m.getApiEndpoint = function(playerInfo,callBack) {
  var req = [];
  [
    requestType.GET_PLAYER,
    requestType.GET_HATCHED_EGGS,
    requestType.GET_INVENTORY,
    requestType.CHECK_AWARDED_BADGES,
    requestType.DOWNLOAD_SETTINGS
  ].forEach(function(i) {
    req.push(new Request({'request_type': i}));
  });
  m.apiRequest(playerInfo, req, function(err, f_ret) {
    if(err) return callBack(err);
    if (f_ret && f_ret.api_url && f_ret.api_url !== "") {
      var api_endpoint = 'https://' + f_ret.api_url + '/rpc';
      callBack(null,api_endpoint);
    } else {
      callBack({error: 'No niantic endpoint returned'});
    }
  });
}

m.getProfile = function(playerInfo,callBack) {
  var requests = [
    {
       'name':    'player',
       'type':    requestType.GET_PLAYER,
       'decoder': Responses.GetPlayerResponse
    },
    {
       'name':    'hatched_eggs',
       'type':    requestType.GET_HATCHED_EGGS,
       'decoder': Responses.GetHatchedEggsResponse
    },
    {
       'name':    'inventory',
       'type':    requestType.GET_INVENTORY,
       'decoder': Responses.GetInventoryResponse
    },
    {
       'name':    'award_badges',
       'type':    requestType.CHECK_AWARDED_BADGES,
       'decoder': Responses.CheckAwardedBadgesResponse
    },
    {
       'name':    'settings',
       'type':    requestType.DOWNLOAD_SETTINGS,
       'decoder': Responses.DownloadSettingsResponse
    }
  ];
  var req = [];
  requests.forEach(function(i) {
    req.push(new Request({'request_type': i.type}));
  });
  m.apiRequest(playerInfo, req, function(err, f_ret) {
    if(err) return callBack(err);
    var respt = {};
    var c = 0;
    requests.forEach(function(i) {
      try {
        respt[i.name] = i.decoder.decode(f_ret.returns[c]); 
      } catch(e) {
        respt[i.name] = {'error': e};
      }
      c++;
    });
    callBack(null,respt);
  });
}

m.getMapObjects = function(playerInfo,callBack) {
  var seconds = new Date().getTime();
  var nullarray = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  var finalWalk = [];
  m.getNeighbors(playerInfo).sort().forEach(function(k) {
    finalWalk.push(k.id());
  });

  var requests = [
    {
       'name':    'map_objects',
       'type':    requestType.GET_MAP_OBJECTS,
       'decoder': Responses.GetMapObjectsResponse,
       'message': new Messages.GetMapObjectsMessage({
          'cell_id':            finalWalk,
          'since_timestamp_ms': nullarray,
          'latitude':           playerInfo.latitude,
          'longitude':          playerInfo.longitude 
       }) 
    },
    {
       'name':    'hatched_eggs',
       'type':    requestType.GET_HATCHED_EGGS,
       'decoder': Responses.GetHatchedEggsResponse
    },
    {
       'name':    'inventory',
       'type':    requestType.GET_INVENTORY,
       'decoder': Responses.GetInventoryResponse,
       'message': new Messages.GetInventoryMessage({
          'last_timestamp_ms': seconds
       })
    },
    {
       'name':    'award_badges',
       'type':    requestType.CHECK_AWARDED_BADGES,
       'decoder': Responses.CheckAwardedBadgesResponse
    },
    {
       'name':    'settings',
       'type':    requestType.DOWNLOAD_SETTINGS,
       'decoder': Responses.DownloadSettingsResponse,
       'message': new Messages.DownloadSettingsMessage({
         'hash': '05daf51635c82611d1aac95c0b051d3ec088a930'
       })
    }
  ];
  var req = [];
  requests.forEach(function(i) {
    if(i.message) {
      req.push(new Request({
        'request_type':    i.type,
        'request_message': i.message.encode()
      }))
    } else {
      req.push(new Request({'request_type': i.type}));
    }
  });
  m.apiRequest(playerInfo, req, function(err, f_ret) {
    if(err) return callBack(err);
    var respt = {};
    var c = 0;
    requests.forEach(function(i) {
      try {
        respt[i.name] = i.decoder.decode(f_ret.returns[c]);
      } catch(e) {
        respt[i.name] = {'error': e};
      }
      c++;
    });
    callBack(null,respt);
  });
};

m.getNeighbors = function(playerInfo) {
  var latlng = new s2.S2LatLng(playerInfo.latitude, playerInfo.longitude);
  var origin = new s2.S2CellId(latlng).parent(15);
  var walk = [origin];
  var next = origin.next();
  var prev = origin.prev();
  [0,1,2,3,4,5,6,7,8,9].forEach(function(i) {
    walk.push(prev);
    walk.push(next);
    next = next.next();
    prev = prev.prev();
  });
  return walk
}
