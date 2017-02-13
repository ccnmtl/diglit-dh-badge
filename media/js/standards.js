/* global Backbone: true, _: true, jQuery: true */


var Standard = Backbone.Model.extend({
    defaults: {
    },
    toTemplate: function() {
        return _(this.attributes).clone();
    }
});


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
        return this.findWhere({id: id});
    },
    byType: function(type) {
        var lst = this.where({Type: type});
        for (var i=0; i < lst.length; i++) {
            lst[i] = lst[i].toTemplate();
        }
        return lst;
    }
});


var StandardView = Backbone.View.extend({
    events: {
        'click a[href="#"]': 'passiveClick',
        'click .competency-detail': 'onDetail'
    },
    initialize: function(options) {
        _.bindAll(this, 'render', 'initStandards', 'passiveClick', 'onDetail');

        this.competencies = ['technical', 'administrative', 'intellectual'];

        this.allTemplate = _.template(options.allTemplate.html());
        this.coreTemplate = _.template(options.coreTemplate.html());
        this.detailTemplate = _.template(options.detailTemplate.html());

        Papa.parse(options.url, {
            download: true,
            header: true,
            complete: this.initStandards
        });
    },
    passiveClick: function(evt) {
        evt.preventDefault();
        return false;
    },
    activeCompetency: function(row) {
        var FIELD_ACTIVE = 'Active (y/n)';
        var value = row[FIELD_ACTIVE];
        return value === 'y' || value === 'Y';
    },
    initStandards: function(results) {
        this.standards = new StandardList();
        for (var i=0; i < results.data.length; i++) {
            if (this.activeCompetency(results.data[i])) {
                var std = new Standard(results.data[i]);
                std.set('id', i);
                this.standards.add(std);
            }
        }
        this.render();
    },
    render: function() {
        var ctx = {'standards': this.standards.toTemplate()};
        var $elt = this.$el.find('.standards-container.all');
        $elt.html(this.allTemplate(ctx));

        for (var i=0; i < this.competencies.length; i++) {
            var type = this.competencies[i];
            ctx = {'standards': this.standards.byType(type)};
            $elt = this.$el.find('.standards-container.' + type);
            $elt.html(this.coreTemplate(ctx));
        }
    },
    onDetail: function(evt) {
        var $modal = jQuery('#competency-detail-modal');

        // update modal based on the competency id attributes
        var std = this.standards.byId(jQuery(evt.currentTarget).data('id'));
        var ctx = {'standard': std.toTemplate()};

        $modal.find('.modal-body').html(this.detailTemplate(ctx));
        $modal.modal('show');
    }
});
