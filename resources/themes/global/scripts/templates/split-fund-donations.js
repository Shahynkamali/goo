theme.splitFundDonations = (function (t) {

    function SplitFundDonations(selector) {
        this.vm = new Vue({
            el: selector,
            delimiters: ['${', '}'],
            data: {
                ready: false,
                use_variant_price_presets: false,
                show_cover_costs: false,
                subscription_default_type: null,
                payment_day_options: [],
                payment_weekday_options: [],
                billing_periods: ['onetime'],
                recurring_first_payment_default: null,
                isPaymentProcessing: false,
                variants: [],
                account: null,
                billing_period: null,
                billing_province_label: theme.trans('general.forms.state'),
                input: {
                    recurring_first_payment_today: false,
                    recurring_day: null,
                    recurring_weekday: null,
                    account_type_id: 1,
                    currency_code: Givecloud.config.currency.code,
                    payment_type: Givecloud.Gateway.getDefaultPaymentType(),
                    cover_fees: Givecloud.config.processing_fees.cover,
                    cover_costs_type: Givecloud.config.processing_fees.using_ai ? 'more_costs' : null,
                    billing_title: null,
                    billing_first_name: null,
                    billing_last_name: null,
                    billing_company: null,
                    billing_email: null,
                    email_opt_in: false,
                    billing_address1: null,
                    billing_address2: null,
                    billing_city: null,
                    billing_province_code: null,
                    billing_zip: null,
                    billing_country_code: Givecloud.config.billing_country_code,
                    billing_phone: null,
                    is_anonymous: false,
                    gift_aid: false,
                    comments: ''
                },
                payment: {
                    currency: Givecloud.config.currency.code
                },
                payValidated: false,
                processing: false,
                overlayTimer: null,
                referral_source: null,
                requires_captcha: Givecloud.config.requires_captcha,
                gift_aid: false
            },
            mounted: function () {
                var self = this;

                var uncheck_cover_fees = this.$el.attributes['cover-fees-state'] && this.$el.attributes['cover-fees-state'].value === 'unchecked' ? true : false;
                this.show_cover_costs = parseInt(this.$el.attributes['show-cover-costs'].value, 0) ? true : false;
                this.use_variant_price_presets = parseInt(this.$el.attributes['use-variant-price-presets'].value, 0);
                this.subscription_default_type = this.$el.attributes['subscription-default-type'].value;
                this.payment_day_options = JSON.parse(this.$el.attributes['payment-day-options'].value);
                this.setupWeekdayOptions(JSON.parse(this.$el.attributes['payment-weekday-options'].value));
                this.billing_periods = this.getBillingPeriods(JSON.parse(this.$el.attributes['billing-periods'].value));
                this.billing_period = this.billing_periods[0];
                this.setupVariants(JSON.parse(this.$el.attributes['variants'].value));
                this.recurring_first_payment_default = parseInt(this.$el.attributes['recurring-first-payment-default'].value, 0);
                this.input.recurring_first_payment_today = this.recurring_first_payment_default;
                this.input.recurring_day = (this.payment_day_options.length) ? this.payment_day_options[0] : null;
                this.input.recurring_weekday = (this.payment_weekday_options.length) ? this.payment_weekday_options[0].key : null;

                $(document).on('gc-number-type', function (event) {
                    self.$set(self.payment, 'number_type', event.detail);
                });

                if (this.show_cover_costs) {
                    this.show_cover_costs = this.variants.reduce(function(show_cover_costs, variant) {
                        return show_cover_costs || Boolean(variant.product.cover_costs_enabled);
                    }, false);
                }

                if (!this.show_cover_costs || uncheck_cover_fees) {
                    this.input.cover_fees = false;
                }

                if (this.$refs.referral_source) {
                    this.input.referral_source = this.$refs.referral_source.value;
                }

                this.ready = true;
                theme.collectEvent('view');
            },
            watch: {
                referral_source: function (new_value, old_value) {
                    var self = this;
                    if (new_value !== old_value) {
                        if (new_value === 'other') {
                            this.input.referral_source = null;
                            this.$nextTick(function () {
                                self.$refs.referral_source_other.focus();
                            });
                        } else {
                            this.input.referral_source = new_value;
                        }
                    }
                },
                'input.cover_costs_type': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.input.cover_fees = !!new_value;
                    }
                },
                'input.currency_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.payment.currency = new_value;
                        if (this.input.payment_type === 'bank_account' && !this.supportedPaymentType('bank_account')) {
                            this.input.payment_type = 'credit_card'
                        }
                        jQuery('body').removeClass(function (index, css) {
                            return (css.match(/\bcurrency-\S+/g) || []).join(' ');
                        });
                        jQuery('body').addClass(('currency-' + new_value).toLowerCase());
                    }
                },
                'input.payment_type': function (new_value) {
                    if (new_value !== 'credit_card') {
                        delete this.payment.number;
                        delete this.payment.number_type;
                        delete this.payment.cvv;
                        delete this.payment.exp;
                        delete this.payment.save_payment_method;
                    }
                    if (new_value !== 'bank_account') {
                        delete this.payment.account_holder_type;
                        delete this.payment.account_type;
                        delete this.payment.routing_number;
                        delete this.payment.account_number;
                        delete this.payment.ach_agree_tos;
                        delete this.payment.save_payment_method;
                    }
                    if (new_value !== 'paypal') {
                        delete this.payment.save_payment_method;
                    }
                    if (new_value === 'payment_method' && !this.payment.payment_method) {
                        this.payment.payment_method = t.data_get(this.account, 'payment_methods.0.id');
                    } else {
                        delete this.payment.payment_method;
                    }
                },
                'payment.number': function (new_value, old_value) {
                    if (new_value !== old_value) {
                        this.payment.number_type = Givecloud.CardholderData.getNumberType(new_value);
                    }
                },
                'payment.exp': function (new_value, old_value) {
                    if (new_value !== old_value && new_value > 1) {
                        if (new_value.length === 1) {
                            this.payment.exp = '0' + new_value + ' / ';
                        }
                        if (new_value.length === 2) {
                            this.payment.exp = new_value + ' / ';
                        }
                    }
                },
            },
            computed: {
                total_amount: function () {
                    if (this.input.cover_fees) {
                        return Sugar.Number.round(this.amount + this.fees, 2);
                    }
                    return this.amount;
                },
                gift_aid_enabled : function() {
                    return this.variants.filter(function(variant){
                        return variant.product.is_tax_receiptable && variant.amount > 0;
                    }).length > 0;
                },
                is_uk_address: function () {
                    return this.input.billing_country_code === 'GB';
                },
                cover_costs_eligible_amount: function() {
                    if(this.cover_costs_eligible_items.length <= 0) {
                        return 0;
                    }

                    return this.cover_costs_eligible_items.reduce(t.arrow(this, function(fees, variant) {
                        return fees + variant.amount;
                    }), 0)
                },
                cover_costs_eligible_items: function() {
                    return this.variants.filter(function (variant) {
                        return variant.product.cover_costs_enabled && variant.amount > 0;
                    });
                },
                has_fees: function() {
                    return this.cover_costs_eligible_amount > 0;
                },
                fees: function () {
                    if (Givecloud.config.processing_fees.using_ai) {
                        return this.input.cover_costs_type ? this.cover_costs_amounts[this.input.cover_costs_type] : 0;
                    }
                    var amount = this.cover_costs_eligible_amount;
                    return amount > 0 ? Givecloud.Dcc.getCost(amount, this.input.cover_costs_type) : 0;
                },
                amount: function () {
                    if (this.variants.length == 0)
                        return 0;

                    return this.variants.reduce(function (total, variant) {
                        return total + variant.amount;
                    }, 0);
                },
                amount_today: function () {
                    if (!this.is_recurring || this.input.recurring_first_payment_today) {
                        return this.total_amount;
                    }
                    return 0;
                },
                billing_period_options: function() {
                    var billing_period_options = {
                        'onetime': theme.trans('scripts.templates.split_fund_donations.one_time'),
                        'weekly': theme.trans('scripts.templates.split_fund_donations.recurring_weekly'),
                        'biweekly': theme.trans('scripts.templates.split_fund_donations.recurring_bi_weekly'),
                        'monthly': theme.trans('scripts.templates.split_fund_donations.recurring_monthly'),
                        'quarterly': theme.trans('scripts.templates.split_fund_donations.recurring_quarterly'),
                        'biannually': theme.trans('scripts.templates.split_fund_donations.recurring_bi_annually'),
                        'annually': theme.trans('scripts.templates.split_fund_donations.recurring_annually')
                    };
                    return Sugar.Object.filter(billing_period_options, t.arrow(this, function(val, key) {
                        return this.billing_periods.indexOf(key) !== -1;
                    }));
                },
                recurring_day: function () {
                    if (this.subscription_default_type === 'natural') {
                        return 1;
                    } else if (this.isWeekdayRecurrance) {
                        return null;
                    } else if (this.payment_day_options.length == 1) {
                        return this.payment_day_options[0];
                    } else {
                        return this.input.recurring_day;
                    }
                },
                recurring_weekday: function () {
                    if (this.subscription_default_type === 'natural' || this.isDayRecurrance) {
                        return null;
                    } else if (this.payment_weekday_options.length == 1) {
                        return this.payment_weekday_options[0].key;
                    } else {
                        return this.input.recurring_weekday;
                    }
                },
                isDayRecurrance: function () {
                    return this.subscription_default_type == 'fixed' && ['weekly', 'biweekly'].indexOf(this.billing_period) == -1;
                },
                isWeekdayRecurrance: function () {
                    return this.subscription_default_type == 'fixed' && ['weekly', 'biweekly'].indexOf(this.billing_period) >= 0;
                },
                showDaySelector: function () {
                    return this.is_recurring && this.isDayRecurrance && this.payment_day_options.length > 1;
                },
                showWeekdaySelector: function () {
                    return this.is_recurring && this.isWeekdayRecurrance && this.payment_weekday_options.length > 1;
                },
                showFirstPaymentSelector: function () {
                    var initialChargeRequired = this.variants.reduce(function(requireInitialCharge, variant) {
                        if (variant.product.recurring_first_payment == 2) {
                            return requireInitialCharge || this.recurring_first_payment_default;
                        }
                        return variant.product.recurring_first_payment ? requireInitialCharge : true;
                    }, false);
                    return this.is_recurring && ! initialChargeRequired;
                },
                account_type: function () {
                    return this.account_types.find(function(type) {
                        return type.id == this.input.account_type_id;
                    }.bind(this));
                },
                account_types: function () {
                    return Givecloud.config.account_types;
                },
                config: function () {
                    return Givecloud.config;
                },
                cover_costs_amounts: function() {
                    return this.cover_costs_eligible_items.reduce(t.arrow(this, function(carry, item) {
                        var amounts = Givecloud.Dcc.getCosts(item.amount);
                        carry.minimum_costs = carry.minimum_costs + amounts.minimum_costs;
                        carry.more_costs = carry.more_costs + amounts.more_costs;
                        carry.most_costs = carry.most_costs + amounts.most_costs;
                        return carry;
                    }), {
                        minimum_costs: 0,
                        more_costs: 0,
                        most_costs: 0,
                    });
                },
                currency: function() {
                    var matchingCurrency = this.currencies.find(t.arrow(this, function(currency) {
                        return currency.code === this.input.currency_code;
                    }));
                    return {
                        code: this.input.currency_code,
                        symbol: matchingCurrency ? matchingCurrency.symbol : Givecloud.config.currency.symbol,
                    };
                },
                currencySymbol: function() {
                    return this.currency.symbol;
                },
                currencies: function() {
                    return Givecloud.config.currencies;
                },
                donor_title_options: function () {
                    return Givecloud.config.title_options;
                },
                gateway: function () {
                    return Givecloud.PaymentTypeGateway(this.input.payment_type);
                },
                gocardless_available: function() {
                    if (Givecloud.config.gateways.bank_account === 'gocardless') {
                        return true;
                    }
                },
                paypal_available: function() {
                    var gateway = Givecloud.PaymentTypeGateway('paypal');
                    if (gateway && (this.is_onetime || gateway.referenceTransactions)) {
                        return true;
                    }
                },
                paysafe_checkout_available: function() {
                    var gateway = Givecloud.PaymentTypeGateway('credit_card');
                    if (Givecloud.config.gateways.credit_card === 'paysafe' && gateway.useCheckout) {
                        return this.amount_today > 0;
                    }
                },
                is_onetime: function() {
                    return this.billing_period === 'onetime';
                },
                is_recurring: function() {
                    return !this.is_onetime;
                },
                recurring_desc: function() {
                    var descriptions = {
                        'weekly': theme.trans('scripts.templates.split_fund_donations.per_week'),
                        'biweekly': theme.trans('scripts.templates.split_fund_donations.per_bi_weekly'),
                        'monthly': theme.trans('scripts.templates.split_fund_donations.per_month'),
                        'quarterly': theme.trans('scripts.templates.split_fund_donations.per_quarter'),
                        'biannually': theme.trans('scripts.templates.split_fund_donations.per_bi_annually'),
                        'annually': theme.trans('scripts.templates.split_fund_donations.per_year')
                    };
                    return t.data_get(descriptions, this.billing_period, '');
                },
                referral_sources: function () {
                    return Givecloud.config.referral_sources;
                },
                billing_province_required: function () {
                    if (this.billing_subdivisions && Object.keys(this.billing_subdivisions).length) return 'required';
                },
                unsupported_card_type: function() {
                    return this.payment.number_type && !this.supportedCardType(this.payment.number_type);
                },
            },
            asyncComputed: {
                countries: {
                    get: function() {
                        return Givecloud.Services.Locale.countries().then(function(data) {
                            var countries = [];
                            if (Givecloud.config.force_country) {
                                countries.push({
                                    value: Givecloud.config.force_country,
                                    label: data.countries[Givecloud.config.force_country] || Givecloud.config.force_country,
                                });
                            } else {
                                Givecloud.config.pinned_countries.forEach(function (code) {
                                    countries.push({
                                        value: code,
                                        label: data.countries[code] || code,
                                    });
                                    if (data.countries[code]) {
                                        delete data.countries[code];
                                    }
                                });
                                if (countries.length) {
                                    countries.push({ value: '', label: '--------' });
                                }
                                Sugar.Object.forEach(data.countries, function(name, code) {
                                    countries.push({ value: code, label: name });
                                });
                            }
                            return Promise.resolve(countries);
                        });
                    },
                    default: {}
                },
                billing_subdivisions: {
                    get: function () {
                        return this.getCountryStates(this.input.billing_country_code);
                    },
                    default: {},
                },
            },
            methods: {
                fillAddressFields: function (address) {
                    this.input.billing_address1 = address.line1;
                    this.input.billing_address2 = address.line2;
                    this.input.billing_city = address.city;
                    this.input.billing_zip = address.zip;
                    this.input.billing_country_code = address.country_code;

                    // Deal with province/state dropdown differently as it is populated by an asyncComputed property.
                    // I extracted it to a function to reuse it here, wrapped in a promise
                    // to be able to select the correct province / state.
                    this.getCountryStates(this.input.billing_country_code).then(function (states) {
                        // Match with code.
                        var stateCode = states[address.state_code] ? address.state_code : null;

                        // No match with code, so try to match with name instead.
                        if (! stateCode) {
                            stateCode = Object.keys(states).filter(function (code) {
                                return states[code] === address.state;
                            })[0] || null;
                        }

                        this.input.billing_province_code = stateCode;
                    }.bind(this));
                },
                getCountryStates: function (country) {
                    return Givecloud.Services.Locale.subdivisions(country)
                        .then(function(data) {
                            if (Sugar.Object.size(data.subdivisions)) {
                                this.billing_province_label = theme.trans('general.subdivision_types.' + Sugar.String.underscore(data.subdivision_type));
                                return Promise.resolve(data.subdivisions);
                            }

                            return Promise.resolve(null);
                        }.bind(this));
                },
                money: function(value, includeCode, options) {
                    return theme.money(theme.toNumber(value, 0), this.currency.code, Object.assign({}, options, {
                        showCurrencyCode: includeCode && Givecloud.config.money_with_currency
                    }));
                },
                setupVariants: function(variants) {
                    this.variants = variants.map(function (variant) {
                        variant.image = (variant.feature_image ? variant.feature_image.thumb : (variant.product.feature_image ? variant.product.feature_image.thumb : null));
                        variant.minimum_price_formatted = variant.minimum_price ? theme.formatNumber(variant.minimum_price) : null;
                        variant.price_presets = (variant.price_presets) ? variant.price_presets.split(',') : [];
                        variant.amount = 0;
                        variant.billing_period_variant_ids = {};
                        this.billing_periods.forEach(function(billing_period) {
                            variant.billing_period_variant_ids[billing_period] = this.getIdealVariantIdForBillingPeriod(variant, billing_period);
                        }.bind(this));
                        return variant;
                    }.bind(this));
                },
                getIdealVariantIdForBillingPeriod: function(variant, billing_period) {
                    if (variant.billing_period === billing_period) {
                        return variant.id;
                    }
                    return variant.product.variants.reverse().reduce(function(variant_id, variant) {
                        return variant.billing_period === billing_period ? variant.id : variant_id;
                    }, variant.id);
                },
                setupWeekdayOptions: function (options) {
                    var weekday_options = [];
                    for (var option in options) {
                        if (options.hasOwnProperty(option)) {
                            weekday_options.push({
                                key: option,
                                value: options[option]
                            });
                        }
                    }
                    this.payment_weekday_options = weekday_options;
                },
                changeBillingPeriod: function (period) {
                    this.billing_period = period;
                },
                chooseAmount: function (variant, amount) {
                    amount = parseFloat(amount);
                    variant.amount = (isNaN(amount) || amount === '') ? 0 : amount;
                },
                supportedCardType: function (type) {
                    return Givecloud.config.supported_cardtypes.indexOf(type) !== -1;
                },
                supportedPaymentType: function(type) {
                    var gateway = Givecloud.PaymentTypeGateway(type);
                    if (type === 'bank_account') {
                        return gateway && gateway.canMakeAchPayment(this.input.currency_code);
                    }
                    if (t.data_get(this.cart, 'requires_ach')) {
                        return false;
                    }
                    return !!gateway;
                },
                paymentExpiry: function (event) {
                    if (event.isTrusted && event.target === document.activeElement) {
                        setTimeout(function () {
                            var position = event.target.value.length;
                            event.target.setSelectionRange(position, position);
                        }, 60);
                    }
                },
                getPercentageFees: function (amount) {
                    var fees = Givecloud.config.processing_fees;
                    return amount * (fees.rate / 100);
                },
                getPerTransactionFee: function () {
                    return Givecloud.config.processing_fees.amount;
                },
                getBillingPeriods: function (data) {
                    if (!Array.isArray(data) || !data.length || data.length == 1 && data[0] === null) {
                        return ['onetime'];
                    }
                    return data;
                },
                paymentOverlay: function (status) {
                    var $modal = $('#payment-overlay');
                    if (status === 'hide') {
                        this.isPaymentProcessing = false;
                    } else {
                        this.isPaymentProcessing = true;
                        $modal.find('.spinner').addClass('d-none');
                        if (status === 'success') {
                            $modal.find('.spinner-success').removeClass('d-none');
                        } else {
                            $modal.find('.spinner-spin').removeClass('d-none');
                        }
                    }
                },
                validatePayForm: function (showErrors) {
                    if (showErrors === void 0 || showErrors) {
                        this.payValidated = true;
                    }
                    return this.$validator.validateAll('pay')
                        .then(function (valid) {
                            if (this.payment.number_type && !this.supportedCardType(this.payment.number_type)) {
                                return Promise.reject(theme.trans('scripts.templates.unsupport_card_type'));
                            }
                            if (!valid || t.bsFormValidate(this.$refs.form) === false) {
                                t.scrollIntoView(this.$el.querySelector('.has-errors'), 85).then(function (element) {
                                    element.find(':input').focus();
                                });
                                return Promise.reject();
                            } else {
                                return Promise.resolve();
                            }
                        }.bind(this));
                },
                hasPriceIssue: function () {
                    var hasIssue = false;
                    if (this.amount === 0) {
                        theme.toast.info(theme.trans('scripts.templates.split_fund_donations.no_donations_yet'));
                        hasIssue = true;
                    }
                    for (var i = 0; i < this.variants.length; i++) {
                        var variant = this.variants[i];
                        if (variant.amount < 0) {
                            theme.toast.info(theme.trans('scripts.templates.split_fund_donations.no_negative_donation', { product: variant.product.name }));
                            hasIssue = true;
                        }
                        if (variant.amount > 0 && variant.minimum_price && variant.amount < variant.minimum_price) {
                            theme.toast.info(theme.trans('scripts.templates.split_fund_donations.not_met_the_minimum_donation_amount', {
                                currency_price: theme.money(variant.minimum_price),
                                product: variant.product.name
                            }));
                            hasIssue = true;
                        }
                    }
                    return hasIssue;
                },
                submitPayForm: function () {
                    if (this.processing) {
                        return;
                    }

                    this.retainProcessingLock();
                    theme.collectEvent('click_pay');

                    if (this.hasPriceIssue()) {
                        this.releaseProcessingLock();
                        return;
                    }

                    this.validatePayForm()
                    .then(function () {
                        var $this = this;
                        this.input.cover_costs_enabled = $this.input.cover_fees;

                        this.input.items = this.variants.map(function (variant) {
                            var data = {
                                variant_id: variant.billing_period_variant_ids[$this.billing_period] || variant.id,
                                amt: variant.amount,
                                qty: 1
                            }
                            if ($this.is_recurring) {
                                data.recurring_frequency = $this.billing_period;
                                data.recurring_day = $this.recurring_day;
                                data.recurring_day_of_week = $this.recurring_weekday;
                                data.recurring_with_initial_charge = $this.input.recurring_first_payment_today;
                            }
                            return data;
                        });

                        // remove $0 line items
                        this.input.items = this.input.items.filter(function (item) {
                            return item.amt !== 0;
                        });

                        this.input.items = this.input.items.map(function (item) {
                            item.gift_aid = $this.gift_aid;
                            return item;
                        });

                        this.paymentOverlay();
                        theme.ladda.start('#btn-pay');

                        Givecloud.Cart.oneClickCheckout(this.input, this.cart, this.input.payment_type)
                            .then(function (data) {
                                this.cart = data.cart;
                                this.account = this.cart.account;
                                if (this.cart.requires_payment) {
                                    this.payment.name = this.cart.billing_address.name;
                                    this.payment.address_line1 = this.cart.billing_address.address1;
                                    this.payment.address_line2 = this.cart.billing_address.address2;
                                    this.payment.address_city = this.cart.billing_address.city;
                                    this.payment.address_state = this.cart.billing_address.province_code;
                                    this.payment.address_zip = this.cart.billing_address.zip;
                                    this.payment.address_country = this.cart.billing_address.country_code;
                                    return this.gateway.getCaptureToken(this.cart, this.payment, this.input.payment_type, this.input.recaptcha_response, this.payment.save_payment_method)
                                        .then(function (token) {
                                            return this.gateway.chargeCaptureToken(this.cart, token);
                                        }.bind(this));
                                }
                                return Givecloud.Cart(this.cart.id).complete();
                            }.bind(this)).then(function () {
                                this.releaseProcessingLock();
                                this.paymentOverlay('success');
                                theme.collectContributionPaid(this.cart);
                                setTimeout(t.arrow(this, function () {
                                    if (this.redirect_url) {
                                        window.location.href = this.redirect_url;
                                    } else {
                                        window.location.href = '/contributions/' + this.cart.id + '/thank-you';
                                    }
                                }), 1000);
                            }.bind(this)).catch(function (err) {
                                if (err) {
                                    if (theme.data_get(err, 'data.captcha')) {
                                        if (this.requires_captcha) {
                                            this.$refs.recaptcha.reset();
                                        } else {
                                            this.requires_captcha = true;
                                        }
                                    }
                                    theme.toast.error(err);
                                }
                                this.releaseProcessingLock();
                                this.paymentOverlay('hide');
                                theme.ladda.stop('#btn-pay');
                            }.bind(this));
                    }.bind(this)).catch(function (err) {
                        this.releaseProcessingLock();
                        if (err) {
                            theme.toast.error(err);
                        }
                    }.bind(this));
                },
                retainProcessingLock: function() {
                    this.processing = true;
                },
                releaseProcessingLock: function() {
                    this.processing = false;
                },
            },
            filters: {
                money: function (value) {
                    return theme.money(value);
                },
                ordinal: function (value) {
                    value = parseInt(value);
                    if (value) {
                        return Sugar.Number.ordinalize(value);
                    }
                },
                size: function (value) {
                    return Sugar.Object.size(value);
                }
            }
        });

        if (Givecloud.config.account_id) {
            Givecloud.Account.get().then(t.arrow(this.vm, function (data) {
                // this needs to happen in the next tick to avoid validation issues
                // https://github.com/baianat/vee-validate/issues/2109
                this.$nextTick(t.arrow(this, function() {
                    this.account = data.account;
                    if (data.account.payment_methods.length) {
                        this.input.payment_type = 'payment_method'
                    }

                    this.input.billing_province_code = t.data_get(data.account, 'billing_address.province_code');
                }));

                this.input.billing_title = t.data_get(data.account, 'billing_address.title');
                this.input.billing_first_name = t.data_get(data.account, 'billing_address.first_name', t.data_get(data.account, 'first_name'));
                this.input.billing_last_name = t.data_get(data.account, 'billing_address.last_name', t.data_get(data.account, 'last_name'));
                this.input.billing_email = t.data_get(data.account, 'billing_address.email', t.data_get(data.account, 'email'));
                this.input.billing_address1 = t.data_get(data.account, 'billing_address.address1');
                this.input.billing_address2 = t.data_get(data.account, 'billing_address.address2');
                this.input.billing_company = t.data_get(data.account, 'billing_address.company');
                this.input.billing_city = t.data_get(data.account, 'billing_address.city');
                this.input.billing_country_code = t.data_get(data.account, 'billing_address.country_code', Givecloud.config.billing_country_code);
                this.input.billing_zip = t.data_get(data.account, 'billing_address.zip');
                this.input.billing_phone = t.data_get(data.account, 'billing_address.phone');
            })).catch(t.noop);
        }
    }

    if (document.querySelectorAll('#split-fund-donations-app').length) {
        return new SplitFundDonations('#split-fund-donations-app');
    }

})(theme);
