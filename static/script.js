/**
 * Market Basket Analysis — Dashboard Script
 * Vanilla JS, no dependencies. IIFE + strict mode.
 */
(function () {
    "use strict";

    /* ======================================================================
       1. CONFIG
       ====================================================================== */
    const API_URL = "/api/analyze";
    const HEALTH_URL = "/api/health";
    const DEFAULTS = { support: 0.005, confidence: 0.10 };
    const PAGE_SIZE = 25;
    const REQUEST_TIMEOUT_MS = 120000;
    const DEBOUNCE_MS = 200;
    const STORAGE_KEY = "mba_last_params";

    /* ======================================================================
       2. SAMPLE DATA
       ====================================================================== */
    let USE_SAMPLE_DATA = false;

    const SAMPLE_RESPONSE = {
        status: "success",
        message: "Market Basket Analysis completed successfully.",
        dataset_info: { file_path: "data/raw/groceries.csv", total_transactions: 14963, unique_items: 167 },
        parameters: { min_support: 0.005, min_confidence: 0.10 },
        summary: { total_frequent_itemsets: 12, total_association_rules: 8 },
        frequent_itemsets: [
            { items: ["whole milk"], size: 1, support: 0.157923 },
            { items: ["other vegetables"], size: 1, support: 0.147340 },
            { items: ["rolls/buns"], size: 1, support: 0.113780 },
            { items: ["soda"], size: 1, support: 0.107148 },
            { items: ["yogurt"], size: 1, support: 0.096918 },
            { items: ["root vegetables"], size: 1, support: 0.078210 },
            { items: ["tropical fruit"], size: 1, support: 0.072580 },
            { items: ["bottled water"], size: 1, support: 0.070610 },
            { items: ["sausage"], size: 1, support: 0.060530 },
            { items: ["citrus fruit"], size: 1, support: 0.055000 },
            { items: ["whole milk", "other vegetables"], size: 2, support: 0.047420 },
            { items: ["whole milk", "rolls/buns"], size: 2, support: 0.035660 }
        ],
        association_rules: [
            { antecedent: ["other vegetables"], consequent: ["whole milk"], support: 0.047420, confidence: 0.321790, lift: 2.037350 },
            { antecedent: ["whole milk"], consequent: ["other vegetables"], support: 0.047420, confidence: 0.300200, lift: 2.037350 },
            { antecedent: ["rolls/buns"], consequent: ["whole milk"], support: 0.035660, confidence: 0.313370, lift: 1.984100 },
            { antecedent: ["yogurt"], consequent: ["whole milk"], support: 0.028900, confidence: 0.298130, lift: 1.887600 },
            { antecedent: ["root vegetables"], consequent: ["whole milk"], support: 0.025100, confidence: 0.320920, lift: 2.031800 },
            { antecedent: ["tropical fruit"], consequent: ["whole milk"], support: 0.022300, confidence: 0.307200, lift: 1.945060 },
            { antecedent: ["soda"], consequent: ["whole milk"], support: 0.018100, confidence: 0.168900, lift: 1.069700 },
            { antecedent: ["sausage"], consequent: ["rolls/buns"], support: 0.012200, confidence: 0.201600, lift: 0.872100 }
        ]
    };

    // Support ?sample=1 query param
    if (new URLSearchParams(window.location.search).get("sample") === "1") {
        USE_SAMPLE_DATA = true;
    }

    /* ======================================================================
       3. STATE
       ====================================================================== */
    let currentResponse = null;
    let elapsedInterval = null;
    let abortController = null;

    const tableState = {
        itemsets: { sortKey: "support", sortDir: "desc", page: 0, filtered: [] },
        rules:    { sortKey: "lift",    sortDir: "desc", page: 0, filtered: [] }
    };

    /* ======================================================================
       4. HELPERS
       ====================================================================== */
    function formatPercent(x) {
        return (x * 100).toFixed(2) + "%";
    }

    function formatNumber(n) {
        return Number(n).toLocaleString("en-US");
    }

    function formatLift(x) {
        return Number(x).toFixed(2);
    }

    function titleCase(item) {
        if (!item) return "";
        return item.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function joinItems(arr) {
        if (!Array.isArray(arr)) return String(arr);
        return arr.map(titleCase).join(", ");
    }

    function escapeHTML(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments;
            var ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function clamp(val, lo, hi) {
        return Math.max(lo, Math.min(hi, val));
    }

    function csvQuote(val) {
        var s = String(val);
        if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    /* ======================================================================
       5. DOM REFERENCES
       ====================================================================== */
    var $ = function (id) { return document.getElementById(id); };

    var dom = {
        // Health
        healthBadge:   $("healthBadge"),
        healthText:    $("healthText"),
        // Controls
        supportInput:      $("supportInput"),
        supportSlider:     $("supportSlider"),
        supportHelper:     $("supportHelper"),
        confidenceInput:   $("confidenceInput"),
        confidenceSlider:  $("confidenceSlider"),
        confidenceHelper:  $("confidenceHelper"),
        runBtn:            $("runBtn"),
        runBtnText:        $("runBtnText"),
        resetBtn:          $("resetBtn"),
        formError:         $("formError"),
        lowSupportHint:    $("lowSupportHint"),
        // Status
        statusInitial: $("statusInitial"),
        statusLoading: $("statusLoading"),
        statusError:   $("statusError"),
        statusInfo:    $("statusInfo"),
        elapsedTime:   $("elapsedTime"),
        errorMessage:  $("errorMessage"),
        infoMessage:   $("infoMessage"),
        retryBtn:      $("retryBtn"),
        // Sample
        sampleBadge:   $("sampleBadge"),
        // Summary
        summary:       $("summary"),
        valTransactions: $("valTransactions"),
        valUniqueItems:  $("valUniqueItems"),
        valItemsets:     $("valItemsets"),
        valRules:        $("valRules"),
        summaryMeta:     $("summaryMeta"),
        // Itemsets table
        itemsetsSection: $("itemsets"),
        itemsetsBody:    $("itemsetsBody"),
        itemsetSearch:   $("itemsetSearch"),
        itemsetSizeFilter: $("itemsetSizeFilter"),
        itemsetCounter:    $("itemsetCounter"),
        itemsetsPrev:      $("itemsetsPrev"),
        itemsetsNext:      $("itemsetsNext"),
        itemsetsPageInfo:  $("itemsetsPageInfo"),
        exportItemsetsBtn: $("exportItemsetsBtn"),
        // Rules table
        rulesSection:  $("rules"),
        rulesBody:     $("rulesBody"),
        ruleSearch:    $("ruleSearch"),
        ruleLiftFilter: $("ruleLiftFilter"),
        ruleCounter:   $("ruleCounter"),
        rulesPrev:     $("rulesPrev"),
        rulesNext:     $("rulesNext"),
        rulesPageInfo: $("rulesPageInfo"),
        exportRulesBtn: $("exportRulesBtn")
    };

    /* ======================================================================
       6. VALIDATION
       ====================================================================== */
    function validate() {
        var supportVal = dom.supportInput.value.trim();
        var confidenceVal = dom.confidenceInput.value.trim();
        var errors = [];

        // Reset
        dom.supportInput.removeAttribute("aria-invalid");
        dom.confidenceInput.removeAttribute("aria-invalid");
        dom.formError.hidden = true;
        dom.formError.textContent = "";

        // Support checks
        if (supportVal === "" || isNaN(Number(supportVal))) {
            errors.push({ field: dom.supportInput, msg: "Minimum Support must be a valid number." });
        } else {
            var s = Number(supportVal);
            if (s <= 0 || s > 1) {
                errors.push({ field: dom.supportInput, msg: "Minimum Support must be greater than 0 and at most 1." });
            }
        }

        // Confidence checks
        if (confidenceVal === "" || isNaN(Number(confidenceVal))) {
            errors.push({ field: dom.confidenceInput, msg: "Minimum Confidence must be a valid number." });
        } else {
            var c = Number(confidenceVal);
            if (c < 0 || c > 1) {
                errors.push({ field: dom.confidenceInput, msg: "Minimum Confidence must be between 0 and 1." });
            }
        }

        if (errors.length > 0) {
            errors.forEach(function (e) { e.field.setAttribute("aria-invalid", "true"); });
            dom.formError.textContent = errors.map(function (e) { return e.msg; }).join(" ");
            dom.formError.hidden = false;
            errors[0].field.focus();
            return null;
        }

        return { min_support: Number(supportVal), min_confidence: Number(confidenceVal) };
    }

    /* ======================================================================
       7. STATUS PANEL HELPERS
       ====================================================================== */
    function showPanel(panel) {
        dom.statusInitial.hidden = true;
        dom.statusLoading.hidden = true;
        dom.statusError.hidden = true;
        dom.statusInfo.hidden = true;
        if (panel) panel.hidden = false;
    }

    function setLoading(on) {
        var chips = document.querySelectorAll(".btn-chip");
        if (on) {
            dom.runBtn.disabled = true;
            dom.runBtnText.textContent = "Running…";
            chips.forEach(function (c) { c.disabled = true; });
        } else {
            dom.runBtn.disabled = false;
            dom.runBtnText.textContent = "Run Analysis";
            chips.forEach(function (c) { c.disabled = false; });
        }
    }

    /* ======================================================================
       8. API — runAnalysis
       ====================================================================== */
    async function runAnalysis() {
        var params = validate();
        if (!params) return;

        // Cancel any in-flight request
        if (abortController) {
            abortController.abort();
            abortController = null;
        }

        // Clear previous results
        clearResults();
        showPanel(dom.statusLoading);
        setLoading(true);

        // Elapsed timer
        var startTime = performance.now();
        dom.elapsedTime.textContent = "0";
        if (elapsedInterval) clearInterval(elapsedInterval);
        elapsedInterval = setInterval(function () {
            dom.elapsedTime.textContent = Math.floor((performance.now() - startTime) / 1000);
        }, 1000);

        // Save to localStorage
        saveParams(params.min_support, params.min_confidence);

        try {
            var data;
            var elapsed;

            if (USE_SAMPLE_DATA) {
                // Simulate delay
                await new Promise(function (res) { setTimeout(res, 600); });
                data = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
                data.parameters = { min_support: params.min_support, min_confidence: params.min_confidence };
                elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            } else {
                abortController = new AbortController();
                var timeoutId = setTimeout(function () { abortController.abort(); }, REQUEST_TIMEOUT_MS);

                var res = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);
                elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

                data = await res.json();

                if (!res.ok) {
                    throw new Error(data && data.message ? data.message : "Server error (HTTP " + res.status + ")");
                }
            }

            clearInterval(elapsedInterval);
            elapsedInterval = null;
            abortController = null;

            currentResponse = data;
            currentResponse._elapsed = elapsed;

            // Check for empty results
            var noItemsets = !data.frequent_itemsets || data.frequent_itemsets.length === 0;
            var noRules = !data.association_rules || data.association_rules.length === 0;

            if (noItemsets) {
                showPanel(dom.statusInfo);
                dom.infoMessage.textContent = data.message || "No frequent itemsets found at these thresholds.";
                renderSummary(data, elapsed);
                // Show summary but hide tables
                dom.summary.hidden = false;
                dom.itemsetsSection.hidden = true;
                dom.rulesSection.hidden = true;
            } else if (noRules) {
                showPanel(dom.statusInfo);
                dom.infoMessage.textContent = data.message || "Frequent itemsets found, but no association rules satisfied the confidence threshold.";
                renderSummary(data, elapsed);
                renderItemsets(data);
                dom.summary.hidden = false;
                dom.itemsetsSection.hidden = false;
                dom.rulesSection.hidden = true;
            } else {
                showPanel(null); // Hide all status panels
                renderSummary(data, elapsed);
                renderItemsets(data);
                renderRules(data);
                dom.summary.hidden = false;
                dom.itemsetsSection.hidden = false;
                dom.rulesSection.hidden = false;
            }

            // Smooth-scroll to summary
            dom.summary.scrollIntoView({ behavior: "smooth", block: "start" });

        } catch (err) {
            clearInterval(elapsedInterval);
            elapsedInterval = null;
            abortController = null;

            showPanel(dom.statusError);

            if (err.name === "AbortError") {
                dom.errorMessage.textContent = "Request timed out. Try a higher min_support value for faster results.";
            } else if (err.message && err.message.indexOf("Failed to fetch") !== -1) {
                dom.errorMessage.textContent = "Cannot reach the backend. Make sure `python run_ui.py` is running.";
                setHealthBadge("offline");
            } else {
                dom.errorMessage.textContent = err.message || "An unexpected error occurred.";
            }
        } finally {
            setLoading(false);
        }
    }

    /* ======================================================================
       9. RENDERING
       ====================================================================== */
    function clearResults() {
        currentResponse = null;
        dom.summary.hidden = true;
        dom.itemsetsSection.hidden = true;
        dom.rulesSection.hidden = true;
        dom.itemsetsBody.innerHTML = "";
        dom.rulesBody.innerHTML = "";
        dom.valTransactions.textContent = "—";
        dom.valUniqueItems.textContent = "—";
        dom.valItemsets.textContent = "—";
        dom.valRules.textContent = "—";
        dom.summaryMeta.textContent = "";
        dom.itemsetCounter.textContent = "Showing 0 of 0";
        dom.ruleCounter.textContent = "Showing 0 of 0";
        // Reset table state
        tableState.itemsets.page = 0;
        tableState.itemsets.filtered = [];
        tableState.rules.page = 0;
        tableState.rules.filtered = [];
        // Reset filters
        dom.itemsetSearch.value = "";
        dom.itemsetSizeFilter.value = "all";
        dom.ruleSearch.value = "";
        dom.ruleLiftFilter.value = "0";
    }

    function renderSummary(data, elapsed) {
        var info = data.dataset_info || {};
        var summ = data.summary || {};
        var params = data.parameters || {};

        dom.valTransactions.textContent = formatNumber(info.total_transactions || 0);
        dom.valUniqueItems.textContent  = formatNumber(info.unique_items || 0);
        dom.valItemsets.textContent     = formatNumber(summ.total_frequent_itemsets || 0);
        dom.valRules.textContent        = formatNumber(summ.total_association_rules || 0);

        dom.summaryMeta.textContent = "Parameters used: min support " +
            formatPercent(params.min_support) + " \u00B7 min confidence " +
            formatPercent(params.min_confidence) + " \u00B7 completed in " + elapsed + " s";
    }

    /* ----- Itemsets ----- */
    function renderItemsets(data) {
        var items = (data.frequent_itemsets || []).slice();
        tableState.itemsets.allData = items;
        applyItemsetFilters();
    }

    function applyItemsetFilters() {
        var items = tableState.itemsets.allData || [];
        var search = dom.itemsetSearch.value.trim().toLowerCase();
        var sizeFilter = dom.itemsetSizeFilter.value;

        var filtered = items.filter(function (it) {
            // Search filter
            if (search && joinItems(it.items).toLowerCase().indexOf(search) === -1) return false;
            // Size filter
            if (sizeFilter !== "all") {
                if (sizeFilter === "4+") {
                    if (it.size < 4) return false;
                } else {
                    if (it.size !== Number(sizeFilter)) return false;
                }
            }
            return true;
        });

        // Sort
        var key = tableState.itemsets.sortKey;
        var dir = tableState.itemsets.sortDir === "asc" ? 1 : -1;
        filtered.sort(function (a, b) {
            var va, vb;
            if (key === "items") {
                va = joinItems(a.items);
                vb = joinItems(b.items);
                return va.localeCompare(vb) * dir;
            }
            va = a[key]; vb = b[key];
            return (va - vb) * dir;
        });

        tableState.itemsets.filtered = filtered;
        tableState.itemsets.page = 0;
        renderItemsetPage();
    }

    function renderItemsetPage() {
        var filtered = tableState.itemsets.filtered;
        var page = tableState.itemsets.page;
        var start = page * PAGE_SIZE;
        var end = Math.min(start + PAGE_SIZE, filtered.length);
        var maxSupport = 0;

        // Find max support for bar visualisation
        if (filtered.length > 0) {
            for (var i = 0; i < filtered.length; i++) {
                if (filtered[i].support > maxSupport) maxSupport = filtered[i].support;
            }
        }
        if (maxSupport === 0) maxSupport = 1;

        var tbody = dom.itemsetsBody;
        tbody.innerHTML = "";

        if (filtered.length === 0) {
            var tr = document.createElement("tr");
            tr.className = "empty-row";
            var td = document.createElement("td");
            td.colSpan = 4;
            td.textContent = (tableState.itemsets.allData && tableState.itemsets.allData.length > 0)
                ? "No rows match your filters"
                : "No frequent itemsets";
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else {
            for (var j = start; j < end; j++) {
                var item = filtered[j];
                var row = document.createElement("tr");

                var tdNum = document.createElement("td");
                tdNum.className = "col-num";
                tdNum.textContent = j + 1;
                row.appendChild(tdNum);

                var tdItems = document.createElement("td");
                tdItems.textContent = joinItems(item.items);
                row.appendChild(tdItems);

                var tdSize = document.createElement("td");
                tdSize.textContent = item.size;
                row.appendChild(tdSize);

                var tdSupport = document.createElement("td");
                var barWrap = document.createElement("div");
                barWrap.className = "support-bar-wrap";
                var spanPct = document.createElement("span");
                spanPct.textContent = formatPercent(item.support);
                var barDiv = document.createElement("div");
                barDiv.className = "support-bar";
                var fillDiv = document.createElement("div");
                fillDiv.className = "support-bar-fill";
                fillDiv.style.width = ((item.support / maxSupport) * 100).toFixed(1) + "%";
                barDiv.appendChild(fillDiv);
                barWrap.appendChild(spanPct);
                barWrap.appendChild(barDiv);
                tdSupport.appendChild(barWrap);
                row.appendChild(tdSupport);

                tbody.appendChild(row);
            }
        }

        // Counter
        if (filtered.length === 0) {
            dom.itemsetCounter.textContent = "Showing 0 of 0";
        } else {
            dom.itemsetCounter.textContent = "Showing " + (start + 1) + "–" + end + " of " + filtered.length;
        }

        // Pagination
        var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        dom.itemsetsPrev.disabled = page <= 0;
        dom.itemsetsNext.disabled = page >= totalPages - 1;
        dom.itemsetsPageInfo.textContent = totalPages > 0 ? "Page " + (page + 1) + " of " + totalPages : "";
    }

    /* ----- Rules ----- */
    function renderRules(data) {
        var rules = (data.association_rules || []).slice();
        tableState.rules.allData = rules;
        applyRuleFilters();
    }

    function applyRuleFilters() {
        var rules = tableState.rules.allData || [];
        var search = dom.ruleSearch.value.trim().toLowerCase();
        var minLift = Number(dom.ruleLiftFilter.value) || 0;

        var filtered = rules.filter(function (r) {
            if (search) {
                var combined = joinItems(r.antecedent).toLowerCase() + " " + joinItems(r.consequent).toLowerCase();
                if (combined.indexOf(search) === -1) return false;
            }
            if (r.lift < minLift) return false;
            return true;
        });

        // Sort
        var key = tableState.rules.sortKey;
        var dir = tableState.rules.sortDir === "asc" ? 1 : -1;
        filtered.sort(function (a, b) {
            var va, vb;
            if (key === "antecedent") {
                va = joinItems(a.antecedent);
                vb = joinItems(b.antecedent);
                return va.localeCompare(vb) * dir;
            }
            if (key === "consequent") {
                va = joinItems(a.consequent);
                vb = joinItems(b.consequent);
                return va.localeCompare(vb) * dir;
            }
            va = a[key]; vb = b[key];
            return (va - vb) * dir;
        });

        tableState.rules.filtered = filtered;
        tableState.rules.page = 0;
        renderRulePage();
    }

    function renderRulePage() {
        var filtered = tableState.rules.filtered;
        var page = tableState.rules.page;
        var start = page * PAGE_SIZE;
        var end = Math.min(start + PAGE_SIZE, filtered.length);

        var tbody = dom.rulesBody;
        tbody.innerHTML = "";

        if (filtered.length === 0) {
            var tr = document.createElement("tr");
            tr.className = "empty-row";
            var td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = (tableState.rules.allData && tableState.rules.allData.length > 0)
                ? "No rows match your filters"
                : "No association rules";
            tr.appendChild(td);
            tbody.appendChild(tr);
        } else {
            for (var j = start; j < end; j++) {
                var rule = filtered[j];
                var row = document.createElement("tr");

                // #
                var tdNum = document.createElement("td");
                tdNum.className = "col-num";
                tdNum.textContent = j + 1;
                row.appendChild(tdNum);

                // Antecedent
                var tdAnt = document.createElement("td");
                tdAnt.textContent = joinItems(rule.antecedent);
                row.appendChild(tdAnt);

                // Arrow
                var tdArr = document.createElement("td");
                tdArr.className = "col-arrow";
                tdArr.textContent = "→";
                row.appendChild(tdArr);

                // Consequent
                var tdCon = document.createElement("td");
                tdCon.textContent = joinItems(rule.consequent);
                row.appendChild(tdCon);

                // Support
                var tdSup = document.createElement("td");
                tdSup.textContent = formatPercent(rule.support);
                row.appendChild(tdSup);

                // Confidence
                var tdConf = document.createElement("td");
                tdConf.textContent = formatPercent(rule.confidence);
                row.appendChild(tdConf);

                // Lift (with badge)
                var tdLift = document.createElement("td");
                var badge = document.createElement("span");
                badge.className = "lift-badge";
                badge.textContent = formatLift(rule.lift);
                if (rule.lift > 1.05) {
                    badge.classList.add("lift-positive");
                    badge.title = "Positive association (items bought together more than expected)";
                } else if (rule.lift >= 0.95) {
                    badge.classList.add("lift-neutral");
                    badge.title = "No significant association";
                } else {
                    badge.classList.add("lift-negative");
                    badge.title = "Negative association (items bought together less than expected)";
                }
                tdLift.appendChild(badge);
                row.appendChild(tdLift);

                tbody.appendChild(row);
            }
        }

        // Counter
        if (filtered.length === 0) {
            dom.ruleCounter.textContent = "Showing 0 of 0";
        } else {
            dom.ruleCounter.textContent = "Showing " + (start + 1) + "–" + end + " of " + filtered.length;
        }

        // Pagination
        var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        dom.rulesPrev.disabled = page <= 0;
        dom.rulesNext.disabled = page >= totalPages - 1;
        dom.rulesPageInfo.textContent = totalPages > 0 ? "Page " + (page + 1) + " of " + totalPages : "";
    }

    /* ======================================================================
       10. TABLE SORTING
       ====================================================================== */
    function handleSort(e) {
        var btn = e.target.closest(".sort-btn");
        if (!btn) return;

        var sortKey = btn.getAttribute("data-sort");
        var tableName = btn.getAttribute("data-table");
        var state = tableState[tableName];
        if (!state) return;

        // Toggle direction
        if (state.sortKey === sortKey) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
            state.sortKey = sortKey;
            state.sortDir = "desc";
        }

        // Update aria-sort on all buttons for this table
        var allBtns = document.querySelectorAll('.sort-btn[data-table="' + tableName + '"]');
        allBtns.forEach(function (b) {
            b.setAttribute("aria-sort", "none");
            b.querySelector(".sort-arrow").textContent = "";
        });
        btn.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
        btn.querySelector(".sort-arrow").textContent = state.sortDir === "asc" ? "▲" : "▼";

        // Re-apply filters (which also sorts)
        if (tableName === "itemsets") applyItemsetFilters();
        else applyRuleFilters();
    }

    /* ======================================================================
       11. CSV EXPORT
       ====================================================================== */
    function exportItemsetsCSV() {
        if (!currentResponse) return;
        var filtered = tableState.itemsets.filtered || [];
        if (filtered.length === 0) return;
        var params = currentResponse.parameters || {};
        var lines = ["#,Itemset,Size,Support (%)"];
        for (var i = 0; i < filtered.length; i++) {
            var it = filtered[i];
            lines.push([
                i + 1,
                csvQuote(it.items.map(titleCase).join(" + ")),
                it.size,
                formatPercent(it.support)
            ].join(","));
        }
        var filename = "itemsets_s" + params.min_support + "_c" + params.min_confidence + ".csv";
        downloadCSV(lines.join("\n"), filename);
    }

    function exportRulesCSV() {
        if (!currentResponse) return;
        var filtered = tableState.rules.filtered || [];
        if (filtered.length === 0) return;
        var params = currentResponse.parameters || {};
        var lines = ["#,Antecedent,Consequent,Support (%),Confidence (%),Lift"];
        for (var i = 0; i < filtered.length; i++) {
            var r = filtered[i];
            lines.push([
                i + 1,
                csvQuote(r.antecedent.map(titleCase).join(" + ")),
                csvQuote(r.consequent.map(titleCase).join(" + ")),
                formatPercent(r.support),
                formatPercent(r.confidence),
                formatLift(r.lift)
            ].join(","));
        }
        var filename = "rules_s" + params.min_support + "_c" + params.min_confidence + ".csv";
        downloadCSV(lines.join("\n"), filename);
    }

    function downloadCSV(csvContent, filename) {
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /* ======================================================================
       12. UX — Input Sync, Presets, Health
       ====================================================================== */
    function syncSupportFromInput() {
        var val = Number(dom.supportInput.value);
        dom.supportSlider.value = clamp(val, Number(dom.supportSlider.min), Number(dom.supportSlider.max));
        dom.supportHelper.textContent = dom.supportInput.value + " = " + formatPercent(val);
        updateLowSupportHint(val);
    }

    function syncSupportFromSlider() {
        dom.supportInput.value = dom.supportSlider.value;
        var val = Number(dom.supportSlider.value);
        dom.supportHelper.textContent = dom.supportInput.value + " = " + formatPercent(val);
        updateLowSupportHint(val);
    }

    function syncConfidenceFromInput() {
        var val = Number(dom.confidenceInput.value);
        dom.confidenceSlider.value = clamp(val, Number(dom.confidenceSlider.min), Number(dom.confidenceSlider.max));
        dom.confidenceHelper.textContent = dom.confidenceInput.value + " = " + formatPercent(val);
    }

    function syncConfidenceFromSlider() {
        dom.confidenceInput.value = dom.confidenceSlider.value;
        var val = Number(dom.confidenceSlider.value);
        dom.confidenceHelper.textContent = dom.confidenceInput.value + " = " + formatPercent(val);
    }

    function updateLowSupportHint(val) {
        dom.lowSupportHint.hidden = !(val < 0.001 && val > 0);
    }

    function applyPreset(support, confidence) {
        dom.supportInput.value = support;
        dom.confidenceInput.value = confidence;
        syncSupportFromInput();
        syncConfidenceFromInput();
    }

    function resetAll() {
        applyPreset(DEFAULTS.support, DEFAULTS.confidence);
        clearResults();
        showPanel(dom.statusInitial);
        dom.formError.hidden = true;
        dom.supportInput.removeAttribute("aria-invalid");
        dom.confidenceInput.removeAttribute("aria-invalid");
    }

    function setHealthBadge(status) {
        dom.healthBadge.className = "badge badge-" + status;
        if (status === "online")       dom.healthText.textContent = "Backend: Online";
        else if (status === "offline") dom.healthText.textContent = "Backend: Offline";
        else                           dom.healthText.textContent = "Checking…";
    }

    async function checkHealth() {
        try {
            var res = await fetch(HEALTH_URL, { method: "GET" });
            if (res.ok) {
                setHealthBadge("online");
            } else {
                setHealthBadge("offline");
            }
        } catch (e) {
            setHealthBadge("offline");
        }
    }

    /* localStorage persistence */
    function saveParams(s, c) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ support: s, confidence: c }));
        } catch (e) { /* ignore */ }
    }

    function loadParams() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var p = JSON.parse(raw);
                if (typeof p.support === "number" && typeof p.confidence === "number") {
                    applyPreset(p.support, p.confidence);
                }
            }
        } catch (e) { /* ignore */ }
    }

    /* ======================================================================
       13. INIT — Wire up event listeners
       ====================================================================== */
    function init() {
        // Show sample badge if in sample mode
        if (USE_SAMPLE_DATA) {
            dom.sampleBadge.hidden = false;
        }

        // Restore last params
        loadParams();

        // Health check
        checkHealth();

        // ----- Control sync -----
        dom.supportInput.addEventListener("input", syncSupportFromInput);
        dom.supportSlider.addEventListener("input", syncSupportFromSlider);
        dom.confidenceInput.addEventListener("input", syncConfidenceFromInput);
        dom.confidenceSlider.addEventListener("input", syncConfidenceFromSlider);

        // ----- Presets -----
        document.querySelectorAll(".btn-chip[data-support]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                applyPreset(
                    Number(btn.getAttribute("data-support")),
                    Number(btn.getAttribute("data-confidence"))
                );
            });
        });

        // ----- Run / Reset / Retry -----
        dom.runBtn.addEventListener("click", runAnalysis);
        dom.resetBtn.addEventListener("click", resetAll);
        dom.retryBtn.addEventListener("click", runAnalysis);

        // Enter key in inputs triggers Run
        dom.supportInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); runAnalysis(); }
        });
        dom.confidenceInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); runAnalysis(); }
        });

        // ----- Table sorting (event delegation) -----
        document.addEventListener("click", handleSort);

        // Also handle Enter/Space on sort buttons for keyboard accessibility
        document.addEventListener("keydown", function (e) {
            if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("sort-btn")) {
                e.preventDefault();
                handleSort(e);
            }
        });

        // ----- Table filters (debounced) -----
        dom.itemsetSearch.addEventListener("input", debounce(function () {
            if (tableState.itemsets.allData) applyItemsetFilters();
        }, DEBOUNCE_MS));

        dom.itemsetSizeFilter.addEventListener("change", function () {
            if (tableState.itemsets.allData) applyItemsetFilters();
        });

        dom.ruleSearch.addEventListener("input", debounce(function () {
            if (tableState.rules.allData) applyRuleFilters();
        }, DEBOUNCE_MS));

        dom.ruleLiftFilter.addEventListener("input", debounce(function () {
            if (tableState.rules.allData) applyRuleFilters();
        }, DEBOUNCE_MS));

        // ----- Pagination -----
        dom.itemsetsPrev.addEventListener("click", function () {
            if (tableState.itemsets.page > 0) {
                tableState.itemsets.page--;
                renderItemsetPage();
            }
        });
        dom.itemsetsNext.addEventListener("click", function () {
            var totalPages = Math.ceil(tableState.itemsets.filtered.length / PAGE_SIZE);
            if (tableState.itemsets.page < totalPages - 1) {
                tableState.itemsets.page++;
                renderItemsetPage();
            }
        });
        dom.rulesPrev.addEventListener("click", function () {
            if (tableState.rules.page > 0) {
                tableState.rules.page--;
                renderRulePage();
            }
        });
        dom.rulesNext.addEventListener("click", function () {
            var totalPages = Math.ceil(tableState.rules.filtered.length / PAGE_SIZE);
            if (tableState.rules.page < totalPages - 1) {
                tableState.rules.page++;
                renderRulePage();
            }
        });

        // ----- CSV Export -----
        dom.exportItemsetsBtn.addEventListener("click", exportItemsetsCSV);
        dom.exportRulesBtn.addEventListener("click", exportRulesCSV);
    }

    // Boot
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
