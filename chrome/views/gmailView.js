var Gmail2Trello = Gmail2Trello || {};

Gmail2Trello.GmailView = function (parent) {
    var self = this;

    this.parent = parent;

    this.LAYOUT_DEFAULT = 0;
    this.LAYOUT_SPLIT = 1;
    this.layoutMode = this.LAYOUT_DEFAULT;

    this.event = new EventTarget();
    this.data = null;

    this.$root = null;

    this.parsingData = false;

    this.runaway = 0;

    this.selectors = {
        // selectors mapping, modify here when gmail's markup changes:
        // toolbarButton: '.G-Ni:first',
        emailName: ".gD",
        emailAddress: ".gD", // Was: '.go', now using same name property
        emailCCs: "span[dir='ltr'].g2.ac2",
        emailSubject: ".hP",
        emailBody: ".adn.ads .gs:first .a3s.aiL", // Was: '.a3s.aXjCH', // Was: "div[dir='ltr']:first", // Was: '.adP:first', // Was: '.adO:first'
        emailAttachments: ".aZo", // Was: '.aQy',
        // emailThreadID: ".a3s.aXjCH", // (Ace, 2020-12-01): OBSOLETE?
        emailIDs: [
            "data-thread-perm-id",
            "data-thread-id",
            "data-legacy-thread-id",
        ],
        viewport: ".aia, .nH", // .aia = split view, .nH = breakout view // Was: '.aeJ:first', now using .first()
        // viewportSplit: '.aNW:first', // reading panel OBSOLETE (Ace, 2020-02-15): Don't know that this is ever used any more
        expandedEmails: ".h7",
        hiddenEmails: ".kv",
        emailInThreads: ".kv,.h7",
        timestamp: ".gH .gK .g3",
        host: "span[dir='ltr']", // Was: 'a.gb_b.gb_eb.gb_R'
        emailEmbedded: "div[dir='ltr']",
        emailEmbeddedTitle: ".T-I.J-J5-Ji.aQv.T-I-ax7.L3.a5q",
        emailEmbeddedNameAttr: "aria-label",
    };
};

Gmail2Trello.GmailView.prototype.preDetect = function () {
    var self = this;
    // g2t_log('GmailView:preDetect');

    var $activeGroup = $('.BltHke[role="main"]');

    /* // OBSOLETE (Ace, 2020-02-15): .find is always returning false, don't think detecting split needed any more
    if ($activeGroup.find('.apv, .apN').length > 0) { // .apv = old gmail, .apN = new gmail
        // g2t_log('detect: Detected SplitLayout');

        this.layoutMode = this.LAYOUT_SPLIT;
        this.$root = $activeGroup;
    } else {
*/
    this.layoutMode = this.LAYOUT_DEFAULT;
    this.$root = $("body");
    //  }

    return this.detectToolbar();
};

Gmail2Trello.GmailView.prototype.detect = function () {
    var self = this;
    // g2t_log('GmailView:detect');

    const pre_k = this.preDetect();

    if (pre_k) {
        self.event.fire("onDetected");
    } else {
        self.detectEmailOpeningMode();
    }
};

Gmail2Trello.GmailView.prototype.detectToolbar = function () {
    // g2t_log('GmailView:detectToolbar');
    var self = this;

    var $toolBar = $("[gh='mtb']", this.$root) || null;

    while ($($toolBar).children().length === 1) {
        $toolBar = $($toolBar).children().first();
    }

    this.$toolBar = $toolBar;

    const haveToolBar_k = $toolBar && $toolBar.length > 0 ? true : false;

    if (!haveToolBar_k) {
        setTimeout(function () {
            self.runaway++;
            if (self.runaway > 5) {
                self.runaway = 0;
                g2t_log("GmailView:detectToolbar RUNAWAY FIRED!");
            } else {
                self.event.fire("detectButton");
            }
        }, 2000);
    }

    self.runaway = 0;

    return haveToolBar_k;
};

Gmail2Trello.GmailView.prototype.detectEmailOpeningMode = function () {
    var self = this;
    const sel_k = this.selectors.expandedEmails;
    this.$expandedEmails = this.$root.find(sel_k);

    var result =
        this.$toolBar &&
        this.$toolBar.length > 0 &&
        this.$expandedEmails &&
        this.$expandedEmails.length > 0;
    if (result) {
        // g2t_log('detectEmailOpeningMode: Detected an email is opening: ' + JSON.stringify(this.$expandedEmails));

        //bind events
        var counter = 0;
        this.$root
            .find(
                ".kv:not([g2t_event]), .h7:not([g2t_event]), .kQ:not([g2t_event]), .kx:not([g2t_event])"
            )
            .each(function () {
                counter++;
                $(this)
                    .attr("g2t_event", 1)
                    .click(function () {
                        WaitCounter.start("emailclick", 500, 5, function () {
                            if (self.detectEmailOpeningMode()) {
                                //this.event.fire('onEmailChanged');
                                WaitCounter.stop("emailclick");
                            }
                        });
                    });
            });
        g2t_log(
            "detectEmailOpeningMode: Binded email threads click events: " +
                counter +
                " items"
        );

        this.event.fire("onDetected");
    }
    return result;
};

Gmail2Trello.GmailView.prototype.parseData = function () {
    // g2t_log('parseData');
    if (this.parsingData) {
        return;
    }

    let self = this;
    let data = {};

    let url_with_filename = function (url_in = "", var_in = "") {
        return self.parent.url_add_var(
            url_in,
            self.parent.UNIQUE_URI_VAR + "=/" + var_in
        );
    };

    /* OBSOLETE (Ace, 2020-02-15): Don't think split is different than flat any more
    // find active email
    if (this.layoutMode === this.LAYOUT_SPLIT) {
        $viewport = $(this.selectors.viewportSplit, this.$root);
    } else {
*/
    let selector = this.selectors.viewport;
    $viewport = $(selector, this.$root).first();
    //  }
    // g2t_log('GmailView:parseData::viewport: ' + JSON.stringify($viewport));
    if ($viewport.length == 0) {
        return;
    }

    let y0 = $viewport.offset().top;
    //g2t_log(y0);
    let $visibleMail = null;
    // parse expanded emails again
    selector = this.selectors.expandedEmails;
    $(selector, this.$root).each(function () {
        let $this = $(this);
        if ($visibleMail === null && $this.offset().top >= y0)
            $visibleMail = $this;
    });

    if (!$visibleMail) {
        return;
    }

    // Check for email body first. If we don't have this, then bail.
    selector = this.selectors.emailBody;
    let $emailBody = $(selector, $visibleMail);
    let $emailBody1 = $emailBody[0];
    if (!$emailBody1) {
        g2t_log(
            "GmailView:parseData::emailBody: " + JSON.stringify($emailBody)
        );
        return;
    }

    this.parsingData = true;
    // var startTime = new Date().getTime();

    // host name
    selector = this.selectors.host;
    let $host = $(selector, $visibleMail).first();
    let hostName = ($host.attr("name") || "").trim();
    let hostEmail = ($host.attr("email") || "").trim();
    
    selector = this.selectors.emailCCs;
    let $emailCCs = $(selector, $visibleMail);
    let emailCCs = $emailCCs.map(function () {
        const item_k = ($(this).attr("email") || "").trim();
        if (item_k && item_k.length > 0) {
            return item_k;
        }
    });

    // email name
    selector = this.selectors.emailName;
    let emailName = ($(selector, $visibleMail).attr("name") || "").trim();
    selector = this.selectors.emailAddress;
    let emailAddress = ($(selector, $visibleMail).attr("email") || "").trim();
    
    selector = this.selectors.emailAttachments;
    let emailAttachments = $(selector, $visibleMail).map(function () {
        const item_k = $(this).attr("download_url");
        if (item_k && item_k.length > 0) {
            var attachment = item_k.match(/^([^:]+)\s*:\s*([^:]+)\s*:\s*(.+)$/);
            if (attachment && attachment.length > 3) {
                const name_k = self.parent.decodeEntities(attachment[2]); // was: decodeURIComponent
                const url_k = attachment[3]; // Was: self.parent.midTruncate(attachment[3], 50, '...');
                return {
                    mimeType: attachment[1],
                    name: name_k,
                    // NOTE (Ace@2017-04-20): Adding this explicitly at the end of the URL so it'll pick up the "filename":
                    url: url_with_filename(url_k, name_k),
                    checked: "false",
                }; // [0] is the whole string
            }
        }
    });

    // timestamp
    selector = this.selectors.timestamp;
    const $time_k = $(selector, $visibleMail).first();
    const timeAttr_k = ($time_k.length > 0
        ? $time_k.attr("title") || $time_k.text() || $time_k.attr("alt")
        : ""
    ).trim();

    /* Used to do this to convert to a true dateTime object, but there is too much hassle in doing so:
    const timeCorrected_k = self.parent.parseInternationalDateTime(timeAttr_k);
    const timeAsDate_k = (timeCorrected_k !== '' ? new Date (timeCorrected_k) : '');
    const timeAsDateInvalid_k = timeAsDate_k ? isNaN (timeAsDate_k.getTime()) : true;

    data.time = (timeAsDateInvalid_k ? 'recently' : timeAsDate_k.toString(this.dateFormat || 'MMM d, yyyy'));
    */

    data.time = timeAttr_k || "recently";

    if (data.time === "recently") {
        g2t_log(
            "time-debug: " +
                JSON.stringify({
                    timeAttr_k: timeAttr_k,
                    /*
            'timeCorrected_k': timeCorrected_k,
            'timeAsDate_k': timeAsDate_k,
            'timeAsDateInvalid_k': timeAsDateInvalid_k,
            */
                    time_k: $time_k,
                })
        );
    }

    let from_raw = emailName + " <" + emailAddress + "> " + data.time;
    let from_md = "[" + emailName + "](" + emailAddress + ") " + data.time; // FYI (Ace, 10-Jan-2017): [name](url "comment") is markdown syntax

    // subject
    selector = this.selectors.emailSubject;
    let $subject = $(selector, this.$root);
    data.subject = ($subject.text() || "").trim();

    // Find emailId via legacy
    // <span data-thread-id="#thread-f:1602441164947422913" data-legacy-thread-id="163d03bfda277ec1" data-legacy-last-message-id="163d03bfda277ec1">Tips for using your new inbox</span>
    selector = this.selectors.emailIDs;
    const ids_len_k = selector.length;
    let iter = 0;

    data.emailId = 0;
    do {
        data.emailId = ($subject.attr(selector[iter]) || "").trim(); // Try new Gmail format
    } while (!data.emailId && ++iter < ids_len_k);

    if (!data.emailId) {
        // try to find via explicitly named class item:
        var emailIdViaClass =
            $emailBody1.classList[$emailBody1.classList.length - 1];
        if (emailIdViaClass && emailIdViaClass.length > 1) {
            if (
                emailIdViaClass.charAt(0) === "m" &&
                emailIdViaClass.charAt(1) <= "9"
            ) {
                // Only useful class is m####### otherwise use data legacy
                data.emailId = emailIdViaClass.substr(1);
            } else {
                data.emailId = 0; // Didn't find anything useful
            }
        } else {
            data.emailId = 0;
        }
    }

    let subject = encodeURIComponent(data.subject);
    let dateSearch = encodeURIComponent(data.time);

    let txtAnchor = "Search";
    let txtDirect = "https://mail.google.com/mail/#search/" + subject;
    let txtDirectComment = "Search by subject";

    if (data.emailId && data.emailId.length > 1) {
        txtAnchor = "Id";
        txtDirect =
            "https://mail.google.com" +
            window.location.pathname /* /mail/u/0/ */ +
            "#all/" +
            data.emailId;
        txtDirectComment = "Open by id";
    }

    var txtSearch =
        "https://mail.google.com/mail/#advanced-search/subset=all&has=" +
        subject +
        "&within=1d&date=" +
        dateSearch;

    data.link_raw = "(<" + txtDirect + "> | <" + txtSearch + ">)";
    data.link_md =
        "(" +
        self.parent
            .anchorMarkdownify(txtAnchor, txtDirect, txtDirectComment)
            .trim() + // don't need leading and trailing spaces
        " | " +
        self.parent
            .anchorMarkdownify("Time", txtSearch, "Search by subject + time")
            .trim() + // don't need leading and trailing spaces
        ")";

    // email body
    let make_preprocess_mailto = function (name, email) {
        let forms = [
            "%name% <%email%>",
            "%name% (%email%)",
            "%name% %email%",
            '"%name%" <%email%>',
            '"%name%" (%email%)',
            '"%name%" %email%',
        ];

        const dict = {
            name: name,
            email: email,
        };

        let anchor_md = self.parent.anchorMarkdownify(name, email); // Don't need to add 'mailto:'

        let retn = {};

        $.each(forms, function (iter, item) {
            let item1 = self.parent.replacer(item, dict);
            retn[item1.toLowerCase()] = anchor_md;
        });

        return retn;
    };

    let preprocess = { a: {} };
    $.extend(
        preprocess["a"],
        make_preprocess_mailto(emailName, emailAddress),
        make_preprocess_mailto(hostName, hostEmail)
    );

    let selectedText = this.parent.getSelectedText();

    data.body_raw =
        from_raw +
        ":\n\n" +
        (selectedText ||
            this.parent.markdownify($emailBody1, false, preprocess));
    data.body_md =
        from_md +
        ":\n\n" +
        (selectedText ||
            this.parent.markdownify($emailBody1, true, preprocess));

    data.attachments = emailAttachments;

    let emailImages = {};

    $("img", $emailBody1).each(function (index, value) {
        const href_k = ($(this).prop("src") || "").trim(); // Was attr
        const alt_k = $(this).prop("alt") || "";
        // <div id=":cb" class="T-I J-J5-Ji aQv T-I-ax7 L3 a5q" role="button" tabindex="0" aria-label="Download attachment Screen Shot 2020-02-05 at 6.04.37 PM.png" data-tooltip-class="a1V" data-tooltip="Download"><div class="aSK J-J5-Ji aYr"></div></div>}
        selector = self.selectors.emailEmbedded;
        const $divs_k = $(this).nextAll(selector);
        selector = self.selectors.emailEmbeddedTitle;
        const $div1_k = $divs_k.find(selector).first();
        selector = self.selectors.emailEmbeddedNameAttr;
        const aria_k = $div1_k.attr(selector) || "";
        const aria_split_k = aria_k.split("Download attachment ");
        const aria_name_k = aria_split_k[aria_split_k.length - 1] || "";
        const name_k =
            (alt_k.length > aria_name_k.length ? alt_k : aria_name_k) ||
            self.parent.uriForDisplay(href_k) ||
            "";
        const display_k = self.parent.decodeEntities(
            self.parent.midTruncate(name_k.trim(), 50, "...")
        );
        const type_k = ($(this).prop("type") || "text/link").trim(); // Was attr
        if (href_k.length > 0 && display_k.length > 0) {
            // Will store as key/value pairs to automatically overide duplicates
            emailImages[href_k] = {
                mimeType: type_k,
                name: display_k,
                url: url_with_filename(href_k, name_k),
                checked: "false",
            };
        }
    });

    data.images = Object.values(emailImages);

    //var t = (new Date()).getTime();
    //g2t_log('Elapsed: '+(t-startTime)/1000);
    this.parsingData = false;

    return data;
};
