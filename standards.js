/* global Backbone: true, _: true, jQuery: true, Papa: true */

var Lens = Backbone.Model.extend({
    defaults: {
        name: '',
        description: ''
    },
    toTemplate: function() {
        return _(this.attributes).clone();
    }
});

var LensList = Backbone.Collection.extend({
    model: Lens,
    toTemplate: function() {
        var a = [];
        this.forEach(function(item) {
            a.push(item.toTemplate());
        });
        return a;
    },
    byName: function(name) {
        return this.findWhere({name: name});
    },
    byHref: function(href) {
        return this.findWhere({href: href});
    }
});

var Standard = Backbone.Model.extend(
    {
        defaults: {
        },
        toTemplate: function() {
            return _(this.attributes).clone();
        }
    },
    {
        FIELD_ACTIVE: 'Active (y/n)',
        FIELD_LENS_NAME: 'Lens',
        FIELD_LENS_DESCRIPTION: 'Lens_Description',
        FIELD_MASTERY: 'Mastery'
    }
);

var StandardList = Backbone.Collection.extend({
    model: Standard,
    initialize: function(lst) {
        if (lst !== undefined && lst instanceof Array) {
            for (var i = 0; i < lst.length; i++) {
                var x = new Standard(lst[i]);
                this.add(x);
            }
        }
    },
    toTemplate: function() {
        var a = [];
        this.forEach(function(item) {
            a.push(item.toTemplate());
        });
        return a;
    },
    byId: function(id) {
        return this.findWhere({id: parseInt(id, 10)});
    },
    byTypeAndMastery: function(type, mastery) {
        var ctx = {};
        ctx[Standard.FIELD_MASTERY] = mastery;
        if (type) {
            ctx[Standard.FIELD_LENS_NAME] = type;
        }

        var a = this.where(ctx);
        for (var i = 0; i < a.length; i++) {
            a[i] = a[i].toTemplate();
        }

        return a;
    }
});

var State = Backbone.Model.extend({
    defaults: {
        activeStandard: undefined,
        activeLens: undefined
    },
    initialize: function(description) {
        var allLens = new Lens({
            name: 'All Competencies',
            href: 'all',
            description: description
        });

        var lenses = new LensList([allLens]);
        this.set('lenses', lenses);

        this.set('standards', new StandardList());
    },
    context: function() {
        var filter = this.get('activeLens').get('filter');
        var standards = this.get('standards');
        var ctx = {
            'mastery': [
                standards.byTypeAndMastery(filter, '1'),
                standards.byTypeAndMastery(filter, '2'),
                standards.byTypeAndMastery(filter, '3')
             ],
            'lenses': this.get('lenses').toTemplate(),
            'activeLens': this.get('activeLens').toTemplate()
        };

        var std = this.get('activeStandard');
        if (std) {
            ctx.activeStandard = std.toTemplate();
        }
        return ctx;
    },
    slugify: function(str) {
        return str.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    },
    validStandard: function(row) {
        var value = row[Standard.FIELD_ACTIVE];
        return value === 'y' || value === 'Y';
    }
});

var StandardView = Backbone.View.extend({
    events: {
        'click a[href="#"]': 'passiveClick',
        'click a.nav-link': 'onLens',
        'click .competency-detail': 'onShowDetail'
    },
    initialize: function(options) {
        _.bindAll(this, 'render', 'onLens', 'onShowDetail', 'onHideDetail',
            'addHistory', 'popHistory', 'setState', 'onParseComplete');

        this.state = new State(options.allDescription);
        this.state.on('change:activeStandard', this.render);
        this.state.on('change:activeLens', this.render);

        jQuery('#competency-detail-modal').on(
            'hidden.bs.modal', this.onHideDetail);

        this.lensTemplate = _.template(options.lensTemplate.html());
        this.standardsTemplate = _.template(options.standardsTemplate.html());
        this.detailTemplate = _.template(options.detailTemplate.html());

        jQuery(window).on('popstate', this.popHistory);

        var self = this;
        Papa.parse(options.url, {
            download: true,
            header: true,
            complete: function(results) {
                self.onParseComplete(results);
            }
        });
    },
    addHistory: function(lens, standard) {
        if (window.history.pushState) {
            var state = {'lens': lens.get('href')};
            var url = '#/' + state.lens + '/';
            if (standard) {
                state.standard = standard.get('id');
                url += state.standard + '/';
            }
            window.history.pushState(state, '', url);
        }
    },
    popHistory: function(evt) {
        var state = evt.originalEvent.state;
        if (state) {
            this.setState(state.lens, state.standard);
        }
    },
    onParseComplete: function(results) {
        for (var i = 0; i < results.data.length; i++) {
            if (!this.state.validStandard(results.data[i])) {
                continue;
            }

            var std = new Standard(results.data[i]);
            std.set('id', i + 1);
            this.state.get('standards').add(std);

            var lensName = results.data[i][Standard.FIELD_LENS_NAME];
            if (lensName.length > 0 &&
                    !this.state.get('lenses').byName(lensName)) {
                var lens = new Lens({
                    name: lensName,
                    filter: lensName,
                    href: this.state.slugify(lensName),
                    description:
                        results.data[i][Standard.FIELD_LENS_DESCRIPTION]
                });
                this.state.get('lenses').add(lens);
            }
        }

        // setState based on location.hash
        // url structure is /lens/<name>/std/<id>/
        var parts = window.location.hash.split('/');
        if (parts.length < 2) {
            this.setState('all');
        } else if (parts.length == 3) {
            this.setState(parts[1]);
        } else if (parts.length == 4) {
            this.setState(parts[1], parts[2]);
        }
    },
    setState: function(lensHref, standardId) {
        var lens = this.state.get('lenses').byHref(lensHref);

        if (standardId) {
            var std = this.state.get('standards').byId(standardId);
            this.state.set({'activeStandard': std, 'activeLens': lens});
        } else {
            this.state.set({'activeStandard': undefined, 'activeLens': lens});
        }
    },
    render: function() {
        var ctx = this.state.context();

        var $elt = this.$el.find('.standards-container');
        $elt.html(this.standardsTemplate(ctx));

        $elt = this.$el.find('.lens-container');
        $elt.html(this.lensTemplate(ctx));

        this.$el.find('.grid').masonry({
            // options
            itemSelector: '.grid-item',
            columnWidth: 220,
            transitionDuration: '0.2s'
        });

        if (ctx.activeStandard) {
            this.$modal = jQuery('#competency-detail-modal');
            this.$modal.find('.modal-body').html(this.detailTemplate(ctx));
            this.$modal.modal('show');
        } else if (this.$modal) {
            this.$modal.forceClose = true;
            this.$modal.modal('hide');
        }
    },
    onLens: function(evt) {
        evt.preventDefault();
        var lensName = jQuery(evt.currentTarget).data('name');
        var lens = this.state.get('lenses').byName(lensName);
        this.addHistory(lens);
        this.state.set('activeLens', lens);
    },
    onShowDetail: function(evt) {
        evt.preventDefault();
        var id = jQuery(evt.currentTarget).data('id');
        var std = this.state.get('standards').byId(id);
        this.addHistory(this.state.get('activeLens'), std);
        this.state.set('activeStandard', std);
    },
    onHideDetail: function(evt) {
        if (!this.$modal.forceClose) {
            this.addHistory(this.state.get('activeLens'));
        }
        delete this.$modal;
        this.state.set('activeStandard', undefined);
    }
});
