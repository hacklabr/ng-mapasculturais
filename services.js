var mapas = angular.module('mapas.service', [])
    .config(['$httpProvider', function ($httpProvider) {
            $httpProvider.defaults.cache = true;
        }]);

mapas.factory('mapas.service.api', ['$http', '$q', function ($http, $q) {
        return function (installationUrl, entity) {
            if (installationUrl[installationUrl.length - 1] !== '/') {
                installationUrl += '/';
            }

            function createUrl(endpoint) {
                return installationUrl + 'api/' + entity + '/' + endpoint;
            }

            function processEntity(entity) {
                if (entity.createTimestamp) {
                    entity.createTimestamp = moment(entity.createTimestamp.date);
                }
                
                var files = {};
                Object.keys(entity).forEach(function (key) {
                    if(key.substr(0,6) === '@files'){
                        files[key.split('.').pop()] = entity[key];
                        delete entity[key];
                    }
                });
                entity['$files'] = files;
                return entity;
            }

            function parseValue(val, escape) {
                val = String(val);
                if (escape) {
                    val = val.replace(/,/g, '\\,');
                }

                return encodeURIComponent(val);
            }

            function getArgs(args) {
                var values = [];

                if (args.length === 1 && args[0] instanceof Array) {
                    args = args[0];
                }

                for (var i in args) {
                    values.push(args[i]);
                }
                return values.map(parseValue).toString();
            }

            var util = {
                applyMe: function () {
                    Object.keys(util).forEach(function (key) {
                        if (key[0] !== 'applyMe') {
                            this[key] = util[key];
                        }
                    });
                },
                createUrl: createUrl,
                parseValue: parseValue,
                processEntity: processEntity,
                $EQ: function (val) {
                    val = parseValue(val);
                    return "EQ(" + val + ")";
                },
                $GT: function (val) {
                    val = parseValue(val);
                    return "GT(" + val + ')';
                },
                $GTE: function (val) {
                    val = parseValue(val);
                    return "GTE(" + val + ')';
                },
                $LT: function (val) {
                    val = parseValue(val);
                    return "LT(" + val + ')';
                },
                $LTE: function (val) {
                    val = parseValue(val);
                    return "LTE(" + val + ')';
                },
                $NULL: function () {
                    return 'NULL()';
                },
                $IN: function () {
                    return 'IN(' + getArgs(arguments) + ')';
                },
                $BET: function (val1, val2) {
                    val1 = parseFloat(val1);
                    val2 = parseFloat(val2);

                    return 'BET(' + [val1, val2] + ')';
                },
                $LIKE: function (val) {
                    val = parseValue(val);
                    return 'LIKE(' + val + ')';
                },
                $ILIKE: function (val) {
                    val = parseValue(val);
                    return 'ILIKE(' + val + ')';
                },
                $GEONEAR: function (longitude, latitude, meters) {
                    return 'GEONEAR(' + [parseFloat(longitude), parseFloat(latitude), parseInt(meters)] + ')';
                },
                $OR: function () {

                    return "OR(" + getArgs(arguments) + ')';
                },
                $AND: function () {
                    return "AND(" + getArgs(arguments) + ')';
                }
            };

            return {
                _select: 'id,name,shortDescription',
                util: util,
                setDefaultSelect: function (select) {
                    this._select = select;
                },
                describe: function () {
                    var url = createUrl('describe');

                    return $http({url: url, method: 'GET'})
                        .then(function (response) {
                            return response.data;
                        });
                },
                getTypes: function () {
                    var url = createUrl('getTypes');

                    return $http({url: url, method: 'GET'})
                        .then(function (response) {
                            if (includeEntityId) {
                                response.data.push(entityId);
                            }
                            return response.data;
                        });
                },
                getChildrenIds: function (entityId, includeEntityId) {
                    var url = createUrl('getChildrenIds/' + entityId);

                    return $http({url: url, method: 'GET'})
                        .then(function (response) {
                            if (includeEntityId) {
                                response.data.push(entityId);
                            }
                            return response.data;
                        });
                },
                find: function (params) {
                    var url = createUrl('find', {params: params});
                    params = params || {'@limit': 10};
                    params['@select'] = (params && params['@select']) || this._select;

                    return $http({url: url, method: 'GET', params: params})
                        .then(function (response) {
                            return response.data.map(processEntity);
                        });
                },
                findOne: function (params) {
                    var url = createUrl(entity, 'findOne', {params: params});

                    params['@select'] = (params && params['@select']) || this._select;

                    return $http.get(url)
                        .then(function (response) {
                            return processEntity(response);
                        });
                },
            }

        }
    }]);

mapas.factory('mapas.service.event', ['$http', '$q', 'mapas.service.api', 'mapas.service.project', 'mapas.service.space', 'mapas.service.agent', function ($http, $q, mapasApi, projectApiService, spaceApiService, agentApiService) {
        return function (installationUrl) {
            //http://spcultura.prefeitura.sp.gov.br/api/event/findByLocation/?&term:linguagem=IN(M%C3%BAsica%20Popular)&@from=2016-02-26&@to=2016-03-26&@select=id,name,type,shortDescription,terms,classificacaoEtaria,project.name,project.singleUrl,occurrences&@files=(avatar.avatarMedium):url&@page=1&@limit=10&@order=name%20ASC
            var api = mapasApi(installationUrl, 'event');
            var projectApi = projectApiService(installationUrl);
            var spaceApi = spaceApiService(installationUrl);
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);

            api.find = function (from, to, params) {
                params = angular.extend({
                    '@select': 'id,name,type,shortDescription,terms,classificacaoEtaria,project.name,owner.id,owner.name',
                    '@files': '(avatar.smallAvatar):url',
                    'space:@select': 'id,name,endereco',
                    'space:@files': '(avatar.avatarSmall):url',
                    '@from': moment(from).format('Y-MM-DD'),
                    '@to': moment(to).format('Y-MM-DD'),
                }, params);

                var url = createUrl('findOccurrences');
                return $http({url: url, method: 'GET', params: params})
                    .then(function (response) {
                        return response.data.map(function(entity){
                            entity.space = processEntity(entity.space);
                            processEntity(entity);
                            entity.start = moment(entity.starts_on + ' ' + entity.starts_at);
                            entity.end = moment((entity.ends_on || entity.starts_on )+ ' ' + entity.ends_at);
                            
                            return entity;
                        });
                    });
            };

            api.findByProject = function (projectId, from, to, params) {
                params = params || {};

                return projectApi.getChildrenIds(projectId, true).then(function (ids) {
                    params.project = $IN(ids);
                    return api.find(from, to, params);
                });
            };

            api.findBySpace = function (spaceId, from, to, params) {
                params = params || {};

                return spaceApi.getChildrenIds(spaceId, true).then(function (ids) {
                    params['space:id'] = $IN(ids);
                    return api.find(from, to, params);
                });
            };

            api.findByOwner = function (agentId, from, to, params) {
                params = params || {};

                return agentApi.getChildrenIds(agentId, true).then(function (ids) {
                    params.owner = $IN(ids);
                    return api.find(from, to, params);
                });
            };
            
            api.group = function(startDateFormat, events){
                var group = [];
                var lastStr;
                var last
                
                events.forEach(function(event){
                    var str = event.start.format(startDateFormat);
                    
                    if(str !== lastStr){
                        console.log(str);
                        lastStr = str;
                        last = {
                            date: moment(str),
                            events: []
                        };
                        
                        group.push(last);
                        
                    }
                    
                    last.events.push(event);
                });
                
                return group;
            };

            return api;
        }
    }]);

mapas.factory('mapas.service.agent', ['$http', '$q', 'mapas.service.api', function ($http, $q, mapasApi) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'agent');

            api.util.applyMe.apply(this);

            api.findByOwner = function (agentId, params) {
                params = params || {};

                return api.getChildrenIds(agentId, true).then(function (ids) {
                    params.parent = $IN(ids);
                    return api.find(params);
                });
            };

            return api;
        }
    }]);

mapas.factory('mapas.service.space', ['$http', '$q', 'mapas.service.api', 'mapas.service.agent', function ($http, $q, mapasApi, agentApiService) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'space');
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);

            api.findByOwner = function (agentId, params) {
                params = params || {};

                return agentApi.getChildrenIds(agentId, true).then(function (ids) {
                    params.owner = $IN(ids);
                    return api.find(params);
                });
            };

            api.findByParent = function (agentId, params) {
                params = params || {};

                return api.getChildrenIds(agentId, true).then(function (ids) {
                    params.owner = $IN(ids);
                    return api.find(params);
                });
            };

            return api;
        }
    }]);

mapas.factory('mapas.service.project', ['$http', '$q', 'mapas.service.api', 'mapas.service.agent', function ($http, $q, mapasApi, agentApiService) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'project');
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);

            api.findByOwner = function (agentId, params) {
                params = params || {};

                return agentApi.getChildrenIds(agentId, true).then(function (ids) {
                    params.owner = $IN(ids);
                    return api.find(params);
                });
            };

            api.findByParent = function (agentId, params) {
                params = params || {};

                return api.getChildrenIds(agentId, true).then(function (ids) {
                    params.owner = $IN(ids);
                    return api.find(params);
                });
            };

            return api;
        }
    }]);
