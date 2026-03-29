const POLL_INTERVAL_MS = 1500;
const buildAICAuthoringPatchPlan = function buildAICAuthoringPatchPlan(inputs) {
    const jsxPatternBlockReasons = new Set(["duplicate_aic_props", "dynamic_existing_aic_prop", "spread_attributes_present"]);
    function normalizeText(value) {
        return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    function slugify(value) {
        const slug = normalizeText(value)
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        return slug || "item";
    }
    function routePrefix(route) {
        return route.replaceAll("/", ".").replace(/^\./, "") || "root";
    }
    function normalizeRoute(route) {
        if (!route || route.trim().length === 0) {
            return "/";
        }
        if (route.startsWith("/")) {
            return route;
        }
        return `/${route.replace(/^\/+/, "")}`;
    }
    function routeFromUrl(url) {
        if (!url) {
            return "/";
        }
        try {
            const parsed = new URL(url);
            return normalizeRoute(parsed.pathname);
        }
        catch {
            return "/";
        }
    }
    function inferAction(role, label) {
        const normalizedLabel = normalizeText(label);
        if (role === "link" || /^go to\b|^view\b|^open\b/.test(normalizedLabel)) {
            return "navigate";
        }
        if (role === "input" || role === "textarea" || role === "searchbox") {
            return "input";
        }
        if (role === "select" || role === "option" || role === "combobox" || role === "listbox") {
            return "select";
        }
        if (role === "checkbox" || role === "radio" || role === "switch") {
            return "toggle";
        }
        if (role === "upload" || normalizedLabel.includes("upload")) {
            return "upload";
        }
        if (/submit|save|place order|confirm|checkout|pay|purchase/.test(normalizedLabel)) {
            return "submit";
        }
        if (/download|export/.test(normalizedLabel)) {
            return "download";
        }
        return "click";
    }
    function inferRisk(label) {
        const normalizedLabel = normalizeText(label);
        if (/delete account|place order|charge|pay now|purchase/.test(normalizedLabel)) {
            return "critical";
        }
        if (/delete|remove|refund|cancel subscription|publish|archive/.test(normalizedLabel)) {
            return "high";
        }
        if (/save|update|create|invite|submit/.test(normalizedLabel)) {
            return "medium";
        }
        return "low";
    }
    function roleFromTag(tagName) {
        switch ((tagName ?? "").toLowerCase()) {
            case "a":
                return "link";
            case "button":
                return "button";
            case "input":
                return "input";
            case "select":
                return "select";
            case "textarea":
                return "textarea";
            default:
                return "generic";
        }
    }
    function createSuggestedId(route, label) {
        return `${routePrefix(route)}.${slugify(label)}`;
    }
    function createSnippetPreview(recommendedProps, recommendedOptionalProps) {
        const lines = [
            `agentId="${recommendedProps.agentId}"`,
            `agentAction="${recommendedProps.agentAction}"`,
            `agentDescription="${recommendedProps.agentDescription}"`,
            `agentRisk="${recommendedProps.agentRisk}"`
        ];
        if (recommendedOptionalProps?.agentRole) {
            lines.push(`agentRole="${recommendedOptionalProps.agentRole}"`);
        }
        if (recommendedOptionalProps?.agentRequiresConfirmation) {
            lines.push("agentRequiresConfirmation");
        }
        if (recommendedOptionalProps?.agentEntityId) {
            lines.push(`agentEntityId="${recommendedOptionalProps.agentEntityId}"`);
        }
        if (recommendedOptionalProps?.agentEntityType) {
            lines.push(`agentEntityType="${recommendedOptionalProps.agentEntityType}"`);
        }
        if (recommendedOptionalProps?.agentEntityLabel) {
            lines.push(`agentEntityLabel="${recommendedOptionalProps.agentEntityLabel}"`);
        }
        if (recommendedOptionalProps?.agentWorkflowStep) {
            lines.push(`agentWorkflowStep="${recommendedOptionalProps.agentWorkflowStep}"`);
        }
        return lines.join("\n");
    }
    function createIssue(code, message, proposalKey, severity = "warning") {
        return {
            code,
            message,
            proposal_key: proposalKey,
            severity
        };
    }
    function setProposalStatus(proposal, nextStatus) {
        const precedence = {
            ignored: 4,
            needs_id_review: 3,
            needs_source_match: 2,
            ready: 1
        };
        if (precedence[nextStatus] > precedence[proposal.status]) {
            proposal.status = nextStatus;
        }
    }
    function appendIssue(proposal, issue, nextStatus) {
        proposal.issues.push(issue);
        if (nextStatus) {
            setProposalStatus(proposal, nextStatus);
        }
    }
    function normalizedRouteForDomCandidate(candidate) {
        return normalizeRoute(candidate.route_pattern ?? routeFromUrl(candidate.page_url));
    }
    function normalizeBootstrapSuggestions(review) {
        if (!review) {
            return [];
        }
        const reviewedSuggestions = Array.isArray(review.suggestions)
            ? review.suggestions.flatMap((entry) => {
                return entry.status === "accepted" && entry.suggestion ? [entry.suggestion] : [];
            })
            : [];
        if (reviewedSuggestions.length > 0) {
            return reviewedSuggestions;
        }
        return Array.isArray(review.draft?.suggestions) ? review.draft.suggestions : [];
    }
    function findBootstrapMatches(candidate, suggestions) {
        const candidateLabel = normalizeText(candidate.label);
        const candidateRoute = normalizedRouteForDomCandidate(candidate);
        return suggestions
            .filter((suggestion) => normalizeRoute(suggestion.route) === candidateRoute)
            .filter((suggestion) => normalizeText(suggestion.label) === candidateLabel)
            .sort((left, right) => right.confidence_score - left.confidence_score);
    }
    function createSourceCandidate(match, matchKind) {
        return {
            action: match.action,
            agentDescription: match.agentDescription,
            agentId: match.agentId,
            column: match.column ?? 1,
            file: match.file,
            line: match.line,
            match_kind: matchKind,
            risk: match.risk,
            source_key: match.source_key ??
                `${match.file}:${match.line}:${match.column ?? 1}:${match.tagName}`,
            tagName: match.tagName
        };
    }
    function dedupeSourceCandidates(candidates) {
        const uniqueCandidates = new Map();
        candidates.forEach((candidate) => {
            const key = `${candidate.match_kind}:${candidate.source_key}`;
            if (!uniqueCandidates.has(key)) {
                uniqueCandidates.set(key, candidate);
            }
        });
        return Array.from(uniqueCandidates.values());
    }
    function createSourceInventoryCandidate(entry, matchKind = "source_inventory_exact") {
        return {
            agentDescription: entry.label,
            agentId: entry.annotated_agent_id,
            column: entry.column,
            duplicate_aic_props: entry.duplicate_aic_props,
            file: entry.file,
            has_spread_attributes: entry.has_spread_attributes,
            line: entry.line,
            match_kind: matchKind,
            opening_tag_signature: entry.opening_tag_signature,
            source_key: entry.source_key,
            tagName: entry.tagName,
            unsupported_aic_props: entry.unsupported_aic_props
        };
    }
    function getSourceInventoryExactMatches(proposal) {
        const report = inputs.project_report;
        const domCandidate = proposal.evidence.dom_candidate;
        if (!report || !domCandidate) {
            return [];
        }
        const inventory = Array.isArray(report.source_inventory) ? report.source_inventory : [];
        const candidateRoute = normalizedRouteForDomCandidate(domCandidate);
        const matchingEntries = inventory.filter((entry) => {
            if (entry.annotated_agent_id) {
                return false;
            }
            if (entry.role !== domCandidate.role) {
                return false;
            }
            if (normalizeText(entry.label) !== normalizeText(domCandidate.label)) {
                return false;
            }
            if (entry.route_pattern && normalizeRoute(entry.route_pattern) !== candidateRoute) {
                return false;
            }
            return true;
        });
        if (matchingEntries.length <= 1) {
            return matchingEntries.map((entry) => createSourceInventoryCandidate(entry));
        }
        const candidateTestId = domCandidate.selectors?.testId?.trim().toLowerCase();
        if (candidateTestId) {
            const testIdMatches = matchingEntries.filter((entry) => entry.selectors?.testId?.trim().toLowerCase() === candidateTestId);
            if (testIdMatches.length > 0) {
                return testIdMatches.map((entry) => createSourceInventoryCandidate(entry));
            }
        }
        const candidateTagName = domCandidate.tag_name?.toLowerCase();
        if (candidateTagName) {
            const tagMatches = matchingEntries.filter((entry) => entry.tagName.toLowerCase() === candidateTagName);
            if (tagMatches.length > 0) {
                return tagMatches.map((entry) => createSourceInventoryCandidate(entry));
            }
        }
        return matchingEntries.map((entry) => createSourceInventoryCandidate(entry));
    }
    function getReviewOnlySourceCandidates(proposal) {
        const report = inputs.project_report;
        if (!report) {
            return [];
        }
        const normalizedDescription = normalizeText(proposal.recommended_props.agentDescription);
        return report.matches
            .filter((match) => normalizeText(match.agentDescription) === normalizedDescription)
            .filter((match) => !match.action || match.action === proposal.recommended_props.agentAction)
            .filter((match) => roleFromTag(match.tagName) === proposal.evidence.snapshot_element?.role ||
            roleFromTag(match.tagName) === proposal.evidence.dom_candidate?.role ||
            (proposal.evidence.snapshot_element === undefined && proposal.evidence.dom_candidate === undefined))
            .map((match) => createSourceCandidate(match, "label_action"));
    }
    function getExactSourceCandidates(proposal) {
        const report = inputs.project_report;
        if (!report) {
            return [];
        }
        if (proposal.kind === "refine_existing") {
            const inventoryMatches = (report.source_inventory ?? [])
                .filter((entry) => entry.annotated_agent_id === proposal.recommended_props.agentId)
                .map((entry) => createSourceInventoryCandidate(entry, "agent_id_exact"));
            if (inventoryMatches.length > 0) {
                return inventoryMatches;
            }
            return report.matches
                .filter((match) => match.agentId === proposal.recommended_props.agentId)
                .map((match) => createSourceCandidate(match, "agent_id_exact"));
        }
        return getSourceInventoryExactMatches(proposal);
    }
    function getApplyBlockReasonFromExactCandidate(candidate) {
        if (candidate.has_spread_attributes) {
            return "spread_attributes_present";
        }
        if ((candidate.duplicate_aic_props?.length ?? 0) > 0) {
            return "duplicate_aic_props";
        }
        if ((candidate.unsupported_aic_props?.length ?? 0) > 0) {
            return "dynamic_existing_aic_prop";
        }
        return undefined;
    }
    function appendExactCandidateBlockIssues(proposal, candidate) {
        if (candidate.has_spread_attributes) {
            appendIssue(proposal, createIssue("spread_attributes_present", "Exact source target uses JSX spread attributes. Guarded apply will not mutate this opening tag.", proposal.key));
        }
        if ((candidate.duplicate_aic_props?.length ?? 0) > 0) {
            appendIssue(proposal, createIssue("duplicate_aic_prop", `Exact source target contains duplicate AIC props: ${candidate.duplicate_aic_props?.join(", ")}.`, proposal.key));
        }
        if ((candidate.unsupported_aic_props?.length ?? 0) > 0) {
            appendIssue(proposal, createIssue("dynamic_aic_prop", `Exact source target contains unsupported dynamic AIC props: ${candidate.unsupported_aic_props?.join(", ")}.`, proposal.key));
        }
    }
    function shouldRecommendExplicitRole(role) {
        return Boolean(role &&
            !["button", "generic", "input", "link", "select", "textarea"].includes(role));
    }
    function getRecommendedOptionalProps(snapshotElement, domCandidate) {
        const recommendedOptionalProps = {};
        const preferredRole = snapshotElement?.role ?? domCandidate?.role;
        if (shouldRecommendExplicitRole(preferredRole)) {
            recommendedOptionalProps.agentRole = preferredRole;
        }
        if (snapshotElement?.requires_confirmation) {
            recommendedOptionalProps.agentRequiresConfirmation = true;
        }
        if (snapshotElement?.entity_ref?.entity_id && snapshotElement.entity_ref.entity_type) {
            recommendedOptionalProps.agentEntityId = snapshotElement.entity_ref.entity_id;
            recommendedOptionalProps.agentEntityType = snapshotElement.entity_ref.entity_type;
            if (snapshotElement.entity_ref.entity_label) {
                recommendedOptionalProps.agentEntityLabel = snapshotElement.entity_ref.entity_label;
            }
        }
        if (snapshotElement?.workflow_ref) {
            recommendedOptionalProps.agentWorkflowStep = snapshotElement.workflow_ref;
        }
        return Object.keys(recommendedOptionalProps).length > 0 ? recommendedOptionalProps : undefined;
    }
    function appendReviewOnlyMetadataIssue(proposal, snapshotElement) {
        if (!snapshotElement) {
            return;
        }
        const reviewOnlyFields = [
            snapshotElement.confirmation ? "agentConfirmation" : undefined,
            snapshotElement.validation ? "agentValidation" : undefined,
            snapshotElement.execution ? "agentExecution" : undefined,
            snapshotElement.recovery ? "agentRecovery" : undefined
        ].filter(Boolean);
        if (reviewOnlyFields.length === 0) {
            return;
        }
        appendIssue(proposal, createIssue("review_only_object_metadata", `Object-valued metadata remains review-only in this milestone: ${reviewOnlyFields.join(", ")}.`, proposal.key, "info"));
    }
    function setApplyState(proposal, exactCandidates) {
        if (proposal.status === "ignored") {
            proposal.apply_status = "blocked";
            proposal.apply_block_reason = "ignored";
            proposal.apply_target = undefined;
            return;
        }
        if (proposal.status !== "ready") {
            proposal.apply_status = "blocked";
            proposal.apply_block_reason = "not_ready";
            proposal.apply_target = undefined;
            return;
        }
        if (exactCandidates.length === 1) {
            const exactCandidate = exactCandidates[0];
            const applyBlockReason = getApplyBlockReasonFromExactCandidate(exactCandidate);
            proposal.apply_target = {
                column: exactCandidate.column,
                file: exactCandidate.file,
                line: exactCandidate.line,
                match_kind: exactCandidate.match_kind,
                opening_tag_signature: exactCandidate.opening_tag_signature,
                source_key: exactCandidate.source_key
            };
            if (applyBlockReason) {
                proposal.apply_status = "blocked";
                proposal.apply_block_reason = applyBlockReason;
                return;
            }
            proposal.apply_status = "eligible";
            proposal.apply_block_reason = undefined;
            return;
        }
        proposal.apply_status = "blocked";
        proposal.apply_target = undefined;
        proposal.apply_block_reason =
            exactCandidates.length > 1
                ? "ambiguous_exact_source_match"
                : proposal.source_candidates.some((candidate) => candidate.match_kind === "label_action")
                    ? "review_only_source_match"
                    : "missing_exact_source_match";
    }
    function applySourceResolution(proposal) {
        if (proposal.status === "ignored") {
            proposal.apply_status = "blocked";
            proposal.apply_block_reason = "ignored";
            return;
        }
        const exactCandidates = getExactSourceCandidates(proposal);
        const reviewOnlyCandidates = getReviewOnlySourceCandidates(proposal);
        proposal.source_candidates = dedupeSourceCandidates([...exactCandidates, ...reviewOnlyCandidates]);
        if (!inputs.project_report) {
            proposal.apply_status = "blocked";
            proposal.apply_block_reason = "missing_exact_source_match";
            return;
        }
        if (exactCandidates.length === 0) {
            appendIssue(proposal, createIssue("missing_source_match", reviewOnlyCandidates.length > 0
                ? "No exact source location was found in the imported project report. Review-only source candidates are attached."
                : "No exact source location was found in the imported project report.", proposal.key), "needs_source_match");
            setApplyState(proposal, exactCandidates);
            return;
        }
        if (exactCandidates.length > 1) {
            appendIssue(proposal, createIssue("ambiguous_source_match", "Multiple exact source candidates matched this proposal in the imported project report.", proposal.key), "needs_source_match");
        }
        if (exactCandidates.length === 1) {
            appendExactCandidateBlockIssues(proposal, exactCandidates[0]);
        }
        setApplyState(proposal, exactCandidates);
    }
    function createSnapshotProposal(element) {
        const action = element.actions[0]?.name ?? inferAction(element.role, element.label);
        const description = element.description ?? element.label;
        const recommended_props = {
            agentAction: action,
            agentDescription: description,
            agentId: element.id,
            agentRisk: element.risk
        };
        const recommended_optional_props = getRecommendedOptionalProps(element, undefined);
        const proposal = {
            apply_status: "blocked",
            bootstrap_backed: false,
            evidence: {
                snapshot_element: element
            },
            issues: [],
            key: `existing:${element.id}`,
            kind: "refine_existing",
            recommended_optional_props,
            recommended_props,
            snippet_preview: createSnippetPreview(recommended_props, recommended_optional_props),
            source_candidates: [],
            status: "ready"
        };
        appendReviewOnlyMetadataIssue(proposal, element);
        return proposal;
    }
    function createDomProposal(candidate, bootstrapSuggestions) {
        const proposalKey = `dom:${candidate.key}`;
        const bootstrapMatches = findBootstrapMatches(candidate, bootstrapSuggestions);
        const uniqueBootstrapTargets = Array.from(new Set(bootstrapMatches.map((suggestion) => suggestion.target)));
        const selectedBootstrapSuggestion = bootstrapMatches[0];
        const route = normalizedRouteForDomCandidate(candidate);
        const recommendedAction = selectedBootstrapSuggestion?.action ?? inferAction(candidate.role, candidate.label);
        const recommendedRisk = selectedBootstrapSuggestion?.risk ?? inferRisk(candidate.label);
        const recommendedId = selectedBootstrapSuggestion?.target ?? createSuggestedId(route, candidate.label);
        const description = selectedBootstrapSuggestion?.label ?? candidate.label;
        const recommended_props = {
            agentAction: recommendedAction,
            agentDescription: description,
            agentId: recommendedId,
            agentRisk: recommendedRisk
        };
        const recommended_optional_props = getRecommendedOptionalProps(undefined, candidate);
        const proposal = {
            apply_status: "blocked",
            bootstrap_backed: Boolean(selectedBootstrapSuggestion),
            evidence: {
                bootstrap_suggestion: selectedBootstrapSuggestion,
                dom_candidate: candidate
            },
            issues: [],
            key: proposalKey,
            kind: "new_annotation",
            recommended_optional_props,
            recommended_props,
            snippet_preview: createSnippetPreview(recommended_props, recommended_optional_props),
            source_candidates: [],
            status: "ready"
        };
        if (uniqueBootstrapTargets.length > 1) {
            appendIssue(proposal, createIssue("ambiguous_bootstrap_match", "Multiple bootstrap suggestions matched this DOM candidate with different target IDs.", proposal.key), "needs_id_review");
        }
        return proposal;
    }
    function domMatchesRuntimeElement(candidate, element) {
        if (candidate.annotated_agent_id && candidate.annotated_agent_id === element.id) {
            return true;
        }
        return (normalizeText(candidate.label) === normalizeText(element.label) &&
            candidate.role === element.role);
    }
    const snapshotElements = inputs.snapshot?.elements ?? [];
    const bootstrapSuggestions = normalizeBootstrapSuggestions(inputs.bootstrap_review);
    const proposals = snapshotElements.map((element) => createSnapshotProposal(element));
    const seenDomKeys = new Set();
    for (const candidate of inputs.dom_candidates ?? []) {
        const duplicateRuntimeElement = snapshotElements.find((element) => domMatchesRuntimeElement(candidate, element));
        if (duplicateRuntimeElement) {
            const recommended_props = {
                agentAction: duplicateRuntimeElement.actions[0]?.name ??
                    inferAction(duplicateRuntimeElement.role, duplicateRuntimeElement.label),
                agentDescription: duplicateRuntimeElement.description ?? duplicateRuntimeElement.label,
                agentId: duplicateRuntimeElement.id,
                agentRisk: duplicateRuntimeElement.risk
            };
            const recommended_optional_props = getRecommendedOptionalProps(duplicateRuntimeElement, candidate);
            proposals.push({
                apply_block_reason: "ignored",
                apply_status: "blocked",
                bootstrap_backed: false,
                evidence: {
                    dom_candidate: candidate,
                    snapshot_element: duplicateRuntimeElement
                },
                issues: [
                    createIssue("duplicate_runtime_match", "DOM candidate overlaps an existing runtime element and was suppressed.", `dom:${candidate.key}`, "info")
                ],
                key: `dom:${candidate.key}`,
                kind: "new_annotation",
                recommended_optional_props,
                recommended_props,
                snippet_preview: createSnippetPreview(recommended_props, recommended_optional_props),
                source_candidates: [],
                status: "ignored"
            });
            continue;
        }
        if (seenDomKeys.has(candidate.key)) {
            const recommended_props = {
                agentAction: inferAction(candidate.role, candidate.label),
                agentDescription: candidate.label,
                agentId: createSuggestedId(normalizedRouteForDomCandidate(candidate), candidate.label),
                agentRisk: inferRisk(candidate.label)
            };
            const recommended_optional_props = getRecommendedOptionalProps(undefined, candidate);
            proposals.push({
                apply_block_reason: "ignored",
                apply_status: "blocked",
                bootstrap_backed: false,
                evidence: {
                    dom_candidate: candidate
                },
                issues: [
                    createIssue("duplicate_dom_candidate", "DOM candidate duplicated an earlier authoring candidate.", `dom:${candidate.key}`, "info")
                ],
                key: `dom:${candidate.key}`,
                kind: "new_annotation",
                recommended_optional_props,
                recommended_props,
                snippet_preview: createSnippetPreview(recommended_props, recommended_optional_props),
                source_candidates: [],
                status: "ignored"
            });
            continue;
        }
        seenDomKeys.add(candidate.key);
        proposals.push(createDomProposal(candidate, bootstrapSuggestions));
    }
    proposals.forEach((proposal) => {
        applySourceResolution(proposal);
    });
    const activeProposals = proposals.filter((proposal) => proposal.status !== "ignored");
    const groupedByAgentId = new Map();
    activeProposals.forEach((proposal) => {
        const group = groupedByAgentId.get(proposal.recommended_props.agentId) ?? [];
        group.push(proposal);
        groupedByAgentId.set(proposal.recommended_props.agentId, group);
    });
    groupedByAgentId.forEach((group, agentId) => {
        if (group.length <= 1) {
            return;
        }
        group.forEach((proposal) => {
            appendIssue(proposal, createIssue("duplicate_proposed_id", `Multiple proposals recommend the same agentId "${agentId}".`, proposal.key), "needs_id_review");
        });
    });
    proposals.forEach((proposal) => {
        setApplyState(proposal, proposal.source_candidates.filter((candidate) => candidate.match_kind === "agent_id_exact" || candidate.match_kind === "source_inventory_exact"));
    });
    const issues = proposals.flatMap((proposal) => proposal.issues);
    return {
        artifact_type: "aic_authoring_patch_plan",
        generated_at: new Date().toISOString(),
        inputs: {
            bootstrap_review: inputs.bootstrap_review,
            dom_candidates: inputs.dom_candidates,
            project_report: inputs.project_report,
            snapshot: inputs.snapshot
        },
        issues,
        proposals,
        summary: {
            apply_ready: proposals.filter((proposal) => proposal.apply_status === "eligible").length,
            blocked_by_jsx_pattern: proposals.filter((proposal) => proposal.apply_block_reason ? jsxPatternBlockReasons.has(proposal.apply_block_reason) : false).length,
            bootstrap_backed_proposals: proposals.filter((proposal) => proposal.bootstrap_backed).length,
            ignored: proposals.filter((proposal) => proposal.status === "ignored").length,
            needs_id_review: proposals.filter((proposal) => proposal.status === "needs_id_review").length,
            needs_source_match: proposals.filter((proposal) => proposal.status === "needs_source_match").length,
            ready: proposals.filter((proposal) => proposal.status === "ready").length,
            review_only_metadata: proposals.filter((proposal) => proposal.issues.some((issue) => issue.code === "review_only_object_metadata")).length,
            source_resolved_proposals: proposals.filter((proposal) => proposal.apply_target !== undefined).length,
            total_proposals: proposals.length
        }
    };
};
const renderAICAuthoringPatchPlanSummary = function renderAICAuthoringPatchPlanSummary(plan) {
    const lines = [
        "AIC Authoring Patch Plan",
        `Generated at: ${plan.generated_at}`,
        `Proposals: ${plan.summary.total_proposals}`,
        `Ready: ${plan.summary.ready}`,
        `Apply ready: ${plan.summary.apply_ready}`,
        `Blocked by JSX pattern: ${plan.summary.blocked_by_jsx_pattern}`,
        `Needs source match: ${plan.summary.needs_source_match}`,
        `Needs ID review: ${plan.summary.needs_id_review}`,
        `Ignored: ${plan.summary.ignored}`,
        `Source resolved: ${plan.summary.source_resolved_proposals}`,
        `Review-only metadata: ${plan.summary.review_only_metadata}`,
        `Bootstrap backed: ${plan.summary.bootstrap_backed_proposals}`,
        "",
        "Proposals:"
    ];
    plan.proposals.forEach((proposal) => {
        const sourceSummary = proposal.source_candidates.length === 1
            ? `${proposal.source_candidates[0].file}:${proposal.source_candidates[0].line}`
            : proposal.source_candidates.length > 1
                ? `${proposal.source_candidates.length} candidates`
                : "no source candidate";
        lines.push(`- ${proposal.key} [${proposal.status}/${proposal.apply_status}] -> ${proposal.recommended_props.agentId} (${sourceSummary}${proposal.apply_block_reason ? `; ${proposal.apply_block_reason}` : ""})`);
    });
    return lines.join("\n");
};

const state = {
  activeView: "inspect",
  autoRefresh: true,
  authoringPlan: undefined,
  baseline: undefined,
  bootstrapReview: undefined,
  connectionMode: "disconnected",
  connectionDetail: "No live snapshot yet.",
  domCandidates: [],
  envelope: undefined,
  projectReport: undefined,
  proposalFilter: "all",
  proposalKey: undefined,
  proposalQuery: "",
  proposalRisk: "all",
  query: "",
  risk: "all",
  role: "all",
  selectedId: undefined,
  tabId: chrome.devtools.inspectedWindow.tabId
};

const metaNode = document.getElementById("meta");
const connectionBadgeNode = document.getElementById("connection-badge");
const connectionDetailNode = document.getElementById("connection-detail");
const inspectTabButton = document.getElementById("inspect-tab");
const authorTabButton = document.getElementById("author-tab");
const refreshButton = document.getElementById("refresh");
const collectDomButton = document.getElementById("collect-dom");
const captureBaselineButton = document.getElementById("capture-baseline");
const copyJsonButton = document.getElementById("copy-json");
const copyDiffButton = document.getElementById("copy-diff");
const importReportButton = document.getElementById("import-report");
const importBootstrapButton = document.getElementById("import-bootstrap");
const copyPlanButton = document.getElementById("copy-plan");
const downloadPlanButton = document.getElementById("download-plan");
const copySummaryButton = document.getElementById("copy-summary");
const autoRefreshNode = document.getElementById("auto-refresh");
const reportFileNode = document.getElementById("report-file");
const bootstrapFileNode = document.getElementById("bootstrap-file");
const inspectViewNode = document.getElementById("inspect-view");
const authorViewNode = document.getElementById("author-view");
const queryNode = document.getElementById("query");
const riskFilterNode = document.getElementById("risk-filter");
const roleFilterNode = document.getElementById("role-filter");
const elementsNode = document.getElementById("elements");
const elementJsonNode = document.getElementById("element-json");
const diffJsonNode = document.getElementById("diff-json");
const rawJsonNode = document.getElementById("raw-json");
const authoringSourcesNode = document.getElementById("authoring-sources");
const proposalQueryNode = document.getElementById("proposal-query");
const proposalFilterNode = document.getElementById("proposal-filter");
const proposalRiskFilterNode = document.getElementById("proposal-risk-filter");
const proposalListNode = document.getElementById("proposal-list");
const proposalJsonNode = document.getElementById("proposal-json");
const proposalSnippetNode = document.getElementById("proposal-snippet");
const planSummaryNode = document.getElementById("plan-summary");
const planJsonNode = document.getElementById("plan-json");

let refreshTimer = undefined;

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortJsonValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableEquals(before, after) {
  return JSON.stringify(sortJsonValue(before)) === JSON.stringify(sortJsonValue(after));
}

function diffFields(before, after, ignoredFields = new Set()) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => !ignoredFields.has(field))
    .filter((field) => !stableEquals(before[field], after[field]))
    .sort();
}

function diffFieldEntries(before, after, ignoredFields = new Set()) {
  return diffFields(before, after, ignoredFields).map((field) => ({
    after: sortJsonValue(after[field]) ?? null,
    before: sortJsonValue(before[field]) ?? null,
    field
  }));
}

function diffUiDetailed(beforeManifest, afterManifest) {
  const beforeElements = new Map((beforeManifest?.elements || []).map((element) => [element.id, element]));
  const afterElements = new Map((afterManifest?.elements || []).map((element) => [element.id, element]));
  const added = Array.from(afterElements.keys()).filter((key) => !beforeElements.has(key)).sort();
  const removed = Array.from(beforeElements.keys()).filter((key) => !afterElements.has(key)).sort();
  const changed = Array.from(beforeElements.keys())
    .filter((key) => afterElements.has(key))
    .flatMap((key) => {
      const beforeElement = beforeElements.get(key);
      const afterElement = afterElements.get(key);
      const changes = diffFieldEntries(beforeElement, afterElement);
      return changes.length > 0 ? [{ changes, key }] : [];
    });

  return {
    added,
    changed,
    kind: "ui",
    removed,
    topLevelChanged: diffFieldEntries(beforeManifest || {}, afterManifest || {}, new Set(["elements", "updated_at", "manifest_version"]))
  };
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function buildEndpoint(pageUrl) {
  const url = new URL(pageUrl);
  return new URL("/.well-known/agent/ui", url.origin).toString();
}

async function getTabUrl() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:get-tab-url"
  });
  return response?.url ?? null;
}

async function getLiveSnapshot() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:get-tab-snapshot"
  });
  return response?.snapshot ?? null;
}

async function collectDomCandidates() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:collect-dom-candidates"
  });
  return Array.isArray(response?.candidates) ? response.candidates : [];
}

async function fetchEndpointSnapshot() {
  const tabUrl = await getTabUrl();

  if (!tabUrl) {
    return null;
  }

  const endpoint = buildEndpoint(tabUrl);
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Endpoint fallback returned " + response.status + ".");
  }

  const manifest = await response.json();
  return {
    captured_at: new Date().toISOString(),
    manifest,
    source: "endpoint",
    version: manifest?.manifest_version || "0.1.0"
  };
}

function matchesFilters(element) {
  const query = state.query.trim().toLowerCase();

  if (state.risk !== "all" && element.risk !== state.risk) {
    return false;
  }

  if (state.role !== "all" && element.role !== state.role) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    element.id,
    element.label,
    element.description,
    element.role,
    element.risk,
    element.entity_ref?.entity_type,
    element.entity_ref?.entity_id,
    element.entity_ref?.entity_label
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesProposalFilters(proposal) {
  const query = state.proposalQuery.trim().toLowerCase();
  const proposalRisk = proposal.recommended_props?.agentRisk || "low";

  if (state.proposalFilter === "ready" && proposal.status !== "ready") {
    return false;
  }

  if (state.proposalFilter === "apply-ready" && proposal.apply_status !== "eligible") {
    return false;
  }

  if (
    state.proposalFilter === "unresolved" &&
    proposal.status !== "needs_source_match" &&
    proposal.status !== "needs_id_review"
  ) {
    return false;
  }

  if (state.proposalFilter === "source-backed" && proposal.source_candidates.length === 0) {
    return false;
  }

  if (state.proposalFilter === "bootstrap-backed" && !proposal.bootstrap_backed) {
    return false;
  }

  if (state.proposalFilter === "ignored" && proposal.status !== "ignored") {
    return false;
  }

  if (state.proposalFilter !== "ignored" && state.proposalFilter !== "all" && proposal.status === "ignored") {
    return false;
  }

  if (state.proposalRisk !== "all" && proposalRisk !== state.proposalRisk) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    proposal.key,
    proposal.recommended_props?.agentId,
    proposal.recommended_props?.agentDescription,
    proposal.recommended_props?.agentAction,
    proposal.recommended_props?.agentRisk,
    ...(proposal.source_candidates || []).flatMap((candidate) => [candidate.file, candidate.agentId])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getCurrentElements() {
  return Array.isArray(state.envelope?.manifest?.elements)
    ? state.envelope.manifest.elements.filter(matchesFilters)
    : [];
}

function getCurrentPlan() {
  return state.authoringPlan;
}

function getVisibleProposals() {
  return Array.isArray(getCurrentPlan()?.proposals)
    ? getCurrentPlan().proposals.filter(matchesProposalFilters)
    : [];
}

function renderConnection() {
  connectionBadgeNode.textContent = state.connectionMode;
  connectionBadgeNode.dataset.tone = state.connectionMode;
  connectionDetailNode.textContent = state.connectionDetail;
}

function renderMeta() {
  const manifest = state.envelope?.manifest;

  if (!manifest) {
    metaNode.textContent = "Waiting for inspected tab...";
    return;
  }

  metaNode.textContent =
    manifest.view.view_id +
    " · " +
    manifest.elements.length +
    " element(s) · " +
    manifest.page.url;
}

function renderViews() {
  const inspectActive = state.activeView === "inspect";
  inspectViewNode.classList.toggle("hidden", !inspectActive);
  authorViewNode.classList.toggle("hidden", inspectActive);
  inspectTabButton.dataset.active = String(inspectActive);
  authorTabButton.dataset.active = String(!inspectActive);
}

function renderElements() {
  const elements = getCurrentElements();
  elementsNode.innerHTML = "";

  if (elements.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "No elements match the current filters.";
    elementsNode.appendChild(emptyNode);
    return;
  }

  elements.forEach((element) => {
    const item = document.createElement("li");
    item.dataset.active = String(state.selectedId === element.id);
    item.innerHTML =
      "<strong>" + element.id + "</strong><br />" +
      "<span class='muted'>" + element.role + " · " + element.risk + "</span>";
    item.addEventListener("click", () => {
      state.selectedId = element.id;
      render();
    });
    elementsNode.appendChild(item);
  });
}

function renderSelectedElement() {
  const elements = Array.isArray(state.envelope?.manifest?.elements) ? state.envelope.manifest.elements : [];
  const selected =
    elements.find((element) => element.id === state.selectedId) ||
    elements.find((element) => matchesFilters(element)) ||
    null;

  if (!selected) {
    elementJsonNode.textContent = "Pick an element from the list.";
    return;
  }

  state.selectedId = selected.id;
  elementJsonNode.textContent = JSON.stringify(selected, null, 2);
}

function renderDiff() {
  if (!state.baseline || !state.envelope?.manifest) {
    diffJsonNode.textContent = "Capture a baseline to compare future snapshots.";
    return;
  }

  diffJsonNode.textContent = JSON.stringify(diffUiDetailed(state.baseline, state.envelope.manifest), null, 2);
}

function renderRawJson() {
  rawJsonNode.textContent = state.envelope?.manifest
    ? JSON.stringify(state.envelope.manifest, null, 2)
    : "Awaiting snapshot...";
}

function renderAuthoringSources() {
  const plan = getCurrentPlan();
  const lines = [
    "Snapshot: " + (state.envelope?.manifest ? "loaded" : "not loaded"),
    "DOM candidates: " + state.domCandidates.length,
    "Project report: " + (state.projectReport ? "loaded" : "not loaded"),
    "Bootstrap review: " + (state.bootstrapReview ? "loaded" : "not loaded")
  ];

  if (plan?.summary) {
    lines.push("Ready proposals: " + plan.summary.ready);
    lines.push("Apply-ready proposals: " + plan.summary.apply_ready);
    lines.push("Blocked by JSX pattern: " + plan.summary.blocked_by_jsx_pattern);
    lines.push("Unresolved proposals: " + (plan.summary.needs_source_match + plan.summary.needs_id_review));
    lines.push("Review-only metadata: " + plan.summary.review_only_metadata);
  }

  authoringSourcesNode.innerHTML = lines.map((line) => "<div>" + line + "</div>").join("");
}

function renderProposalList() {
  const proposals = getVisibleProposals();
  proposalListNode.innerHTML = "";

  if (proposals.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "No authoring proposals match the current filters.";
    proposalListNode.appendChild(emptyNode);
    return;
  }

  proposals.forEach((proposal) => {
    const item = document.createElement("li");
    item.dataset.active = String(state.proposalKey === proposal.key);
    item.innerHTML =
      "<strong>" + proposal.recommended_props.agentId + "</strong><br />" +
      "<span class='muted'>" +
      proposal.status +
      " · " +
      proposal.apply_status +
      " · " +
      proposal.recommended_props.agentRisk +
      "</span>";
    item.addEventListener("click", () => {
      state.proposalKey = proposal.key;
      render();
    });
    proposalListNode.appendChild(item);
  });
}

function renderSelectedProposal() {
  const proposals = Array.isArray(getCurrentPlan()?.proposals) ? getCurrentPlan().proposals : [];
  const selected =
    proposals.find((proposal) => proposal.key === state.proposalKey) ||
    getVisibleProposals()[0] ||
    null;

  if (!selected) {
    proposalJsonNode.textContent = "Select a proposal from the list.";
    proposalSnippetNode.textContent = "Select a proposal from the list.";
    return;
  }

  state.proposalKey = selected.key;
  proposalJsonNode.textContent = JSON.stringify(selected, null, 2);
  proposalSnippetNode.textContent =
    (selected.snippet_preview || "No snippet preview available.") +
    "\n\nApply status: " +
    selected.apply_status +
    (selected.apply_block_reason ? "\nBlock reason: " + selected.apply_block_reason : "") +
    (selected.recommended_optional_props
      ? "\nOptional props: " + Object.keys(selected.recommended_optional_props).join(", ")
      : "") +
    (selected.apply_target
      ? "\nSource target: " +
        selected.apply_target.file +
        ":" +
        selected.apply_target.line +
        ":" +
        selected.apply_target.column
      : "") +
    "\n\nCLI:\naic apply authoring-plan ./aic-authoring-plan.json --project-root . --write";
}

function renderPlanSummary() {
  const plan = getCurrentPlan();
  planSummaryNode.textContent = plan
    ? renderAICAuthoringPatchPlanSummary(plan) +
      "\n\nCLI:\naic apply authoring-plan ./aic-authoring-plan.json --project-root . --write"
    : "No authoring plan generated yet.";
}

function renderPlanJson() {
  const plan = getCurrentPlan();
  planJsonNode.textContent = plan
    ? JSON.stringify(plan, null, 2)
    : "No authoring plan generated yet.";
}

function refreshAuthoringPlan() {
  state.authoringPlan = buildAICAuthoringPatchPlan({
    bootstrap_review: state.bootstrapReview,
    dom_candidates: state.domCandidates,
    project_report: state.projectReport,
    snapshot: state.envelope?.manifest
  });
}

function render() {
  renderConnection();
  renderMeta();
  renderViews();
  renderElements();
  renderSelectedElement();
  renderDiff();
  renderRawJson();
  renderAuthoringSources();
  renderProposalList();
  renderSelectedProposal();
  renderPlanSummary();
  renderPlanJson();
}

async function refreshSnapshot() {
  try {
    const liveSnapshot = await getLiveSnapshot();

    if (liveSnapshot?.manifest) {
      state.envelope = liveSnapshot;
      state.connectionMode = "bridge";
      state.connectionDetail = "Live bridge snapshot · " + (liveSnapshot.captured_at || "unknown timestamp");
      refreshAuthoringPlan();
      render();
      return;
    }

    const endpointSnapshot = await fetchEndpointSnapshot();

    if (endpointSnapshot?.manifest) {
      state.envelope = endpointSnapshot;
      state.connectionMode = "endpoint";
      state.connectionDetail = "Endpoint fallback snapshot";
      refreshAuthoringPlan();
      render();
      return;
    }

    state.connectionMode = "disconnected";
    state.connectionDetail = "No live snapshot or endpoint fallback was available.";
    refreshAuthoringPlan();
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown panel refresh error";
    state.connectionMode = "disconnected";
    state.connectionDetail = message;
    refreshAuthoringPlan();
    render();
  }
}

function syncPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }

  if (state.autoRefresh) {
    refreshTimer = setInterval(() => {
      void refreshSnapshot();
    }, POLL_INTERVAL_MS);
  }
}

async function loadJsonFile(inputNode) {
  const file = inputNode.files?.[0];

  if (!file) {
    return null;
  }

  const contents = await file.text();
  inputNode.value = "";
  return JSON.parse(contents);
}

function downloadTextFile(filename, contents) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

inspectTabButton.addEventListener("click", () => {
  state.activeView = "inspect";
  render();
});

authorTabButton.addEventListener("click", () => {
  state.activeView = "author";
  render();
});

refreshButton.addEventListener("click", () => {
  void refreshSnapshot();
});

collectDomButton.addEventListener("click", async () => {
  state.domCandidates = await collectDomCandidates();
  refreshAuthoringPlan();
  render();
});

captureBaselineButton.addEventListener("click", () => {
  state.baseline = state.envelope?.manifest;
  render();
});

copyJsonButton.addEventListener("click", async () => {
  if (!state.envelope?.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.envelope.manifest, null, 2));
});

copyDiffButton.addEventListener("click", async () => {
  if (!state.baseline || !state.envelope?.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(diffUiDetailed(state.baseline, state.envelope.manifest), null, 2));
});

importReportButton.addEventListener("click", () => {
  reportFileNode.click();
});

importBootstrapButton.addEventListener("click", () => {
  bootstrapFileNode.click();
});

reportFileNode.addEventListener("change", async () => {
  state.projectReport = await loadJsonFile(reportFileNode);
  refreshAuthoringPlan();
  render();
});

bootstrapFileNode.addEventListener("change", async () => {
  state.bootstrapReview = await loadJsonFile(bootstrapFileNode);
  refreshAuthoringPlan();
  render();
});

copyPlanButton.addEventListener("click", async () => {
  if (!state.authoringPlan) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.authoringPlan, null, 2));
});

downloadPlanButton.addEventListener("click", () => {
  if (!state.authoringPlan) {
    return;
  }

  downloadTextFile("aic-authoring-plan.json", JSON.stringify(state.authoringPlan, null, 2));
});

copySummaryButton.addEventListener("click", async () => {
  if (!state.authoringPlan) {
    return;
  }

  await navigator.clipboard.writeText(renderAICAuthoringPatchPlanSummary(state.authoringPlan));
});

autoRefreshNode.addEventListener("change", () => {
  state.autoRefresh = autoRefreshNode.checked;
  syncPolling();
});

queryNode.addEventListener("input", () => {
  state.query = queryNode.value;
  render();
});

riskFilterNode.addEventListener("change", () => {
  state.risk = riskFilterNode.value;
  render();
});

roleFilterNode.addEventListener("change", () => {
  state.role = roleFilterNode.value;
  render();
});

proposalQueryNode.addEventListener("input", () => {
  state.proposalQuery = proposalQueryNode.value;
  render();
});

proposalFilterNode.addEventListener("change", () => {
  state.proposalFilter = proposalFilterNode.value;
  render();
});

proposalRiskFilterNode.addEventListener("change", () => {
  state.proposalRisk = proposalRiskFilterNode.value;
  render();
});

chrome.devtools.network.onNavigated.addListener(() => {
  state.domCandidates = [];
  void refreshSnapshot();
});

refreshAuthoringPlan();
syncPolling();
void refreshSnapshot();
