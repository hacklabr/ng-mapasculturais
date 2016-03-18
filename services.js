var mapas = angular.module('mapas.service', [])
    .config(['$httpProvider', function ($httpProvider) {
            $httpProvider.defaults.cache = true;
        }]);

mapas.factory('mapas.service.api', ['$http', '$q', function ($http, $q) {
        return function (installationUrl) {
            if (installationUrl[installationUrl.length - 1] !== '/') {
                installationUrl += '/';
            }
            
            function createUrl(entity, endpoint) {
                return installationUrl + 'api/' + entity + '/' + endpoint;
            }

            var util = {
                getArgs: function (args) {
                    var values = [];

                    if (args.length === 1 && args[0] instanceof Array) {
                        args = args[0];
                    }

                    for (var i in args) {
                        values.push(args[i]);
                    }
                    return values.map(parseValue).toString();
                }
            };
            
            var api = {
                util: util,
                get: function (entity, endpoint, params) {
                    var url = createUrl(entity, endpoint);

                    return $http.get(url, {params: params})
                        .then(function (response) {
                            return response.data;
                        });
                },
                
                taxonomyTerms: function(taxonomySlug){
                    return api.get('term', 'list/' + taxonomySlug);
                }
            };

            return api;
        }
    }]);

mapas.factory('mapas.service.entity', ['$http', '$q', 'mapas.service.api', function ($http, $q, mapasApi) {
        return function (installationUrl, entity) {
            var api = mapasApi(installationUrl);

            function createUrl(endpoint) {
                return installationUrl + 'api/' + entity + '/' + endpoint;
            }
            
            api.util = angular.extend(api.util, {
                applyMe: function () {
                    Object.keys(api.util).forEach(function (key) {
                        if (key[0] !== 'applyMe') {
                            this[key] = api.util[key];
                        }
                    });
                },
                
                processEntity: function (entity) {
                    if (entity.createTimestamp) {
                        entity.createTimestamp = moment(entity.createTimestamp.date);
                    }
                    
                    if(entity.shortDescription){
                        entity.shortDescription = entity.shortDescription.replace(/\n/g, "<br>");
                    }
                    
                    if(entity.longDescription){
                        entity.longDescription = entity.longDescription.replace(/\n/g, "<br>");
                    }

                    var files = {};
                    Object.keys(entity).forEach(function (key) {
                        if (key.substr(0, 6) === '@files') {
                            files[key.split('.').pop()] = entity[key];
                            delete entity[key];
                        }
                    });
                    entity['$files'] = files;
                    return entity;
                },
                parseValue: function (val, escape) {
                    val = String(val);
                    if (escape) {
                        val = val.replace(/,/g, '\\,');
                    }

                    return encodeURIComponent(val);
                },
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
                },
                createUrl: function (endpoint) {
                    return installationUrl + 'api/' + entity + '/' + endpoint;
                }
            });
            
            api._select = 'id,name,type,location,shortDescription,terms';
            api._selectOne = 'id,name,type,location,shortDescription,terms';

            api.setDefaultSelect = function (select) {
                this._select = select;
            };
            
            api.describe = function () {
                var url = createUrl('describe');

                return $http({url: url, method: 'GET'})
                    .then(function (response) {
                        return response.data;
                    });
            };
            
            api.getTypes = function () {
                var url = createUrl('getTypes');

                return $http({url: url, method: 'GET'})
                    .then(function (response) {
                        if (includeEntityId) {
                            response.data.push(entityId);
                        }
                        return response.data;
                    });
            };
            
            api.getChildrenIds = function (entityId, includeEntityId) {
                var url = createUrl('getChildrenIds/' + entityId);
                
                return $http({url: url, method: 'GET'})
                    .then(function (response) {
                        if (includeEntityId) {
                            response.data.push(entityId);
                        }
                        return response.data;
                    });
            };
            
            api.find = function (params) {
                var url = createUrl('find', {params: params});
                params = angular.extend({
                    '@select': api._select,
                    '@files': '(avatar.avatarSmall):url',
                }, params);

                params['@select'] = (params && params['@select']) || this._select;

                return $http({url: url, method: 'GET', params: params})
                    .then(function (response) {
                        return response.data.map(processEntity);
                    });
            };
            
            api.findOne = function (params) {
                params = angular.extend({
                    '@select': api._selectOne || api._select,
                    '@files': '(avatar.avatarSmall, avatar.avatarMedium, avatar.avatarBig, avatar.avatarEvent):url',
                }, params);
                var url = createUrl('findOne', {params: params});

                params['@select'] = (params && params['@select']) || this._select;

                return $http.get(url, {params: params})
                    .then(function (response) {
                        return processEntity(response.data);
                    });
            };
            
            return api;

        }
    }]);

mapas.factory('mapas.service.event', ['$http', '$q', 'mapas.service.entity', 'mapas.service.project', 'mapas.service.space', 'mapas.service.agent', function ($http, $q, mapasApi, projectApiService, spaceApiService, agentApiService) {
        return function (installationUrl) {
            //http://spcultura.prefeitura.sp.gov.br/api/event/findByLocation/?&term:linguagem=IN(M%C3%BAsica%20Popular)&@from=2016-02-26&@to=2016-03-26&@select=id,name,type,shortDescription,terms,classificacaoEtaria,project.name,project.singleUrl,occurrences&@files=(avatar.avatarMedium):url&@page=1&@limit=10&@order=name%20ASC
            var api = mapasApi(installationUrl, 'event');
            var projectApi = projectApiService(installationUrl);
            var spaceApi = spaceApiService(installationUrl);
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);
            api._select = 'id,name,subTitle,type,shortDescription,terms,classificacaoEtaria,project.id,project.name,owner.id,owner.name';
            api._selectOne = 'id,name,subTitle,type,shortDescription,terms,classificacaoEtaria,project.id,project.name,owner.id,owner.name,occurrences';

            api.find = function (from, to, params) {
                params = angular.extend({
                    '@select': api._select,
                    '@files': '(avatar.avatarSmall):url',
                    'space:@select': 'id,name,endereco',
                    'space:@files': '(avatar.avatarSmall):url',
                    '@from': moment(from).format('Y-MM-DD'),
                    '@to': moment(to).format('Y-MM-DD'),
                }, params);

                var url = createUrl('findOccurrences');
                
                return $http({url: url, method: 'GET', params: params})
                    .then(function (response) {
                        return response.data.map(function (entity) {
                            entity.space = processEntity(entity.space);
                            processEntity(entity);
                            entity.start = moment(entity.starts_on + ' ' + entity.starts_at);
                            entity.end = moment((entity.ends_on || entity.starts_on) + ' ' + entity.ends_at);

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


            api.findByEvent = function (eventId, from, to, params) {
                params = params || {};

                params.id = $IN(eventId);

                return api.find(from, to, params);

            };

            api.group = function (startDateFormat, events) {
                var group = [];
                var lastStr;
                var last

                events.forEach(function (event) {
                    var str = event.start.format(startDateFormat);

                    if (str !== lastStr) {
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

mapas.factory('mapas.service.agent', ['$http', '$q', 'mapas.service.entity', function ($http, $q, mapasApi) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'agent');

            api.util.applyMe.apply(this);

            api._select = 'id,name,endereco,type,shortDescription,longDescription,terms,classificacaoEtaria,parent.id,parent.name'
            api._selectOne = 'id,name,endereco,type,shortDescription,longDescription,terms,classificacaoEtaria,parent.id,parent.name'

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

mapas.factory('mapas.service.space', ['$http', '$q', 'mapas.service.entity', 'mapas.service.agent', function ($http, $q, mapasApi, agentApiService) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'space');
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);

            api._selectOne = 'id,name,subTitle,endereco,type,shortDescription,longDescription,terms,classificacaoEtaria,owner.id,owner.name'

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

            api.findByEvents = function (from, to, params) {
                params = angular.extend({
                    '@select': api._select,
                    '@from': moment(from).format('Y-MM-DD'),
                    '@to': moment(to).format('Y-MM-DD'),
                }, params);

                var url = createUrl('findByEvents');
                
                return $http({url: url, method: 'GET', params: params})
                    .then(function (response) {
                        return response.data;
                    });
            };

            return api;
        }
    }]);

mapas.factory('mapas.service.project', ['$http', '$q', 'mapas.service.entity', 'mapas.service.agent', function ($http, $q, mapasApi, agentApiService) {
        return function (installationUrl) {
            var api = mapasApi(installationUrl, 'project');
            var agentApi = agentApiService(installationUrl);

            api.util.applyMe.apply(this);

            api._selectOne = 'id,name,type,shortDescription,longDescription,terms,owner.id,owner.name'

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
