import type {
  AICActionName,
  AICAuthoringBootstrapReviewInput,
  AICAuthoringBootstrapSuggestionInput,
  AICAuthoringInputs,
  AICAuthoringIssue,
  AICAuthoringPatchPlan,
  AICAuthoringProposal,
  AICAuthoringSourceCandidate,
  AICAuthoringSourceInventoryEntry,
  AICDomDiscoveryCandidate,
  AICElementManifest,
  AICRisk,
  AICRole
} from "./types.js";

export function buildAICAuthoringPatchPlan(inputs: AICAuthoringInputs): AICAuthoringPatchPlan {
  const jsxPatternBlockReasons = new Set<
    NonNullable<AICAuthoringProposal["apply_block_reason"]>
  >(["duplicate_aic_props", "dynamic_existing_aic_prop", "spread_attributes_present"]);

  function normalizeText(value: string | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function slugify(value: string): string {
    const slug = normalizeText(value)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return slug || "item";
  }

  function routePrefix(route: string): string {
    return route.replaceAll("/", ".").replace(/^\./, "") || "root";
  }

  function normalizeRoute(route: string | undefined): string {
    if (!route || route.trim().length === 0) {
      return "/";
    }

    if (route.startsWith("/")) {
      return route;
    }

    return `/${route.replace(/^\/+/, "")}`;
  }

  function routeFromUrl(url: string | undefined): string {
    if (!url) {
      return "/";
    }

    try {
      const parsed = new URL(url);
      return normalizeRoute(parsed.pathname);
    } catch {
      return "/";
    }
  }

  function inferAction(role: AICRole, label: string): AICActionName {
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

  function inferRisk(label: string): AICRisk {
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

  function roleFromTag(tagName: string | undefined): AICRole {
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

  function createSuggestedId(route: string, label: string): string {
    return `${routePrefix(route)}.${slugify(label)}`;
  }

  function createSnippetPreview(
    recommendedProps: AICAuthoringProposal["recommended_props"],
    recommendedOptionalProps?: AICAuthoringProposal["recommended_optional_props"]
  ): string {
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

  function createIssue(
    code: AICAuthoringIssue["code"],
    message: string,
    proposalKey: string,
    severity: "info" | "warning" = "warning"
  ): AICAuthoringIssue {
    return {
      code,
      message,
      proposal_key: proposalKey,
      severity
    };
  }

  function setProposalStatus(
    proposal: AICAuthoringProposal,
    nextStatus: AICAuthoringProposal["status"]
  ): void {
    const precedence: Record<AICAuthoringProposal["status"], number> = {
      ignored: 4,
      needs_id_review: 3,
      needs_source_match: 2,
      ready: 1
    };

    if (precedence[nextStatus] > precedence[proposal.status]) {
      proposal.status = nextStatus;
    }
  }

  function appendIssue(
    proposal: AICAuthoringProposal,
    issue: AICAuthoringIssue,
    nextStatus?: AICAuthoringProposal["status"]
  ): void {
    proposal.issues.push(issue);

    if (nextStatus) {
      setProposalStatus(proposal, nextStatus);
    }
  }

  function normalizedRouteForDomCandidate(candidate: AICDomDiscoveryCandidate): string {
    return normalizeRoute(candidate.route_pattern ?? routeFromUrl(candidate.page_url));
  }

  function normalizeBootstrapSuggestions(
    review: AICAuthoringBootstrapReviewInput | undefined
  ): AICAuthoringBootstrapSuggestionInput[] {
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

  function findBootstrapMatches(
    candidate: AICDomDiscoveryCandidate,
    suggestions: AICAuthoringBootstrapSuggestionInput[]
  ): AICAuthoringBootstrapSuggestionInput[] {
    const candidateLabel = normalizeText(candidate.label);
    const candidateRoute = normalizedRouteForDomCandidate(candidate);

    return suggestions
      .filter((suggestion) => normalizeRoute(suggestion.route) === candidateRoute)
      .filter((suggestion) => normalizeText(suggestion.label) === candidateLabel)
      .sort((left, right) => right.confidence_score - left.confidence_score);
  }

  function createSourceCandidate(
    match: {
      action?: string;
      agentDescription?: string;
      agentId?: string;
      column?: number;
      file: string;
      line: number;
      risk?: string;
      source_key?: string;
      tagName: string;
    },
    matchKind: AICAuthoringSourceCandidate["match_kind"]
  ): AICAuthoringSourceCandidate {
    return {
      action: match.action,
      agentDescription: match.agentDescription,
      agentId: match.agentId,
      column: match.column ?? 1,
      file: match.file,
      line: match.line,
      match_kind: matchKind,
      risk: match.risk,
      source_key:
        match.source_key ??
        `${match.file}:${match.line}:${match.column ?? 1}:${match.tagName}`,
      tagName: match.tagName
    };
  }

  function dedupeSourceCandidates(
    candidates: AICAuthoringSourceCandidate[]
  ): AICAuthoringSourceCandidate[] {
    const uniqueCandidates = new Map<string, AICAuthoringSourceCandidate>();

    candidates.forEach((candidate) => {
      const key = `${candidate.match_kind}:${candidate.source_key}`;
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, candidate);
      }
    });

    return Array.from(uniqueCandidates.values());
  }

  function createSourceInventoryCandidate(
    entry: AICAuthoringSourceInventoryEntry,
    matchKind: AICAuthoringSourceCandidate["match_kind"] = "source_inventory_exact"
  ): AICAuthoringSourceCandidate {
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

  function getSourceInventoryExactMatches(
    proposal: AICAuthoringProposal
  ): AICAuthoringSourceCandidate[] {
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
      const testIdMatches = matchingEntries.filter(
        (entry) => entry.selectors?.testId?.trim().toLowerCase() === candidateTestId
      );
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

  function getReviewOnlySourceCandidates(
    proposal: AICAuthoringProposal
  ): AICAuthoringSourceCandidate[] {
    const report = inputs.project_report;

    if (!report) {
      return [];
    }

    const normalizedDescription = normalizeText(proposal.recommended_props.agentDescription);
    return report.matches
      .filter((match) => normalizeText(match.agentDescription) === normalizedDescription)
      .filter((match) => !match.action || match.action === proposal.recommended_props.agentAction)
      .filter(
        (match) =>
          roleFromTag(match.tagName) === proposal.evidence.snapshot_element?.role ||
          roleFromTag(match.tagName) === proposal.evidence.dom_candidate?.role ||
          (proposal.evidence.snapshot_element === undefined && proposal.evidence.dom_candidate === undefined)
      )
      .map((match) => createSourceCandidate(match, "label_action"));
  }

  function getExactSourceCandidates(
    proposal: AICAuthoringProposal
  ): AICAuthoringSourceCandidate[] {
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

  function getApplyBlockReasonFromExactCandidate(
    candidate: AICAuthoringSourceCandidate
  ): AICAuthoringProposal["apply_block_reason"] | undefined {
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

  function appendExactCandidateBlockIssues(
    proposal: AICAuthoringProposal,
    candidate: AICAuthoringSourceCandidate
  ): void {
    if (candidate.has_spread_attributes) {
      appendIssue(
        proposal,
        createIssue(
          "spread_attributes_present",
          "Exact source target uses JSX spread attributes. Guarded apply will not mutate this opening tag.",
          proposal.key
        )
      );
    }

    if ((candidate.duplicate_aic_props?.length ?? 0) > 0) {
      appendIssue(
        proposal,
        createIssue(
          "duplicate_aic_prop",
          `Exact source target contains duplicate AIC props: ${candidate.duplicate_aic_props?.join(", ")}.`,
          proposal.key
        )
      );
    }

    if ((candidate.unsupported_aic_props?.length ?? 0) > 0) {
      appendIssue(
        proposal,
        createIssue(
          "dynamic_aic_prop",
          `Exact source target contains unsupported dynamic AIC props: ${candidate.unsupported_aic_props?.join(", ")}.`,
          proposal.key
        )
      );
    }
  }

  function shouldRecommendExplicitRole(role: AICRole | undefined): boolean {
    return Boolean(
      role &&
        !["button", "generic", "input", "link", "select", "textarea"].includes(role)
    );
  }

  function getRecommendedOptionalProps(
    snapshotElement: AICElementManifest | undefined,
    domCandidate: AICDomDiscoveryCandidate | undefined
  ): AICAuthoringProposal["recommended_optional_props"] | undefined {
    const recommendedOptionalProps: NonNullable<AICAuthoringProposal["recommended_optional_props"]> = {};
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

  function appendReviewOnlyMetadataIssue(
    proposal: AICAuthoringProposal,
    snapshotElement: AICElementManifest | undefined
  ): void {
    if (!snapshotElement) {
      return;
    }

    const reviewOnlyFields = [
      snapshotElement.confirmation ? "agentConfirmation" : undefined,
      snapshotElement.validation ? "agentValidation" : undefined,
      snapshotElement.execution ? "agentExecution" : undefined,
      snapshotElement.recovery ? "agentRecovery" : undefined
    ].filter(Boolean) as string[];

    if (reviewOnlyFields.length === 0) {
      return;
    }

    appendIssue(
      proposal,
      createIssue(
        "review_only_object_metadata",
        `Object-valued metadata remains review-only in this milestone: ${reviewOnlyFields.join(", ")}.`,
        proposal.key,
        "info"
      )
    );
  }

  function setApplyState(
    proposal: AICAuthoringProposal,
    exactCandidates: AICAuthoringSourceCandidate[]
  ): void {
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
        match_kind: exactCandidate.match_kind as "agent_id_exact" | "source_inventory_exact",
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

  function applySourceResolution(proposal: AICAuthoringProposal): void {
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
      appendIssue(
        proposal,
        createIssue(
          "missing_source_match",
          reviewOnlyCandidates.length > 0
            ? "No exact source location was found in the imported project report. Review-only source candidates are attached."
            : "No exact source location was found in the imported project report.",
          proposal.key
        ),
        "needs_source_match"
      );
      setApplyState(proposal, exactCandidates);
      return;
    }

    if (exactCandidates.length > 1) {
      appendIssue(
        proposal,
        createIssue(
          "ambiguous_source_match",
          "Multiple exact source candidates matched this proposal in the imported project report.",
          proposal.key
        ),
        "needs_source_match"
      );
    }

    if (exactCandidates.length === 1) {
      appendExactCandidateBlockIssues(proposal, exactCandidates[0]);
    }

    setApplyState(proposal, exactCandidates);
  }

  function createSnapshotProposal(element: AICElementManifest): AICAuthoringProposal {
    const action = element.actions[0]?.name ?? inferAction(element.role, element.label);
    const description = element.description ?? element.label;
    const recommended_props = {
      agentAction: action,
      agentDescription: description,
      agentId: element.id,
      agentRisk: element.risk
    };
    const recommended_optional_props = getRecommendedOptionalProps(element, undefined);

    const proposal: AICAuthoringProposal = {
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

  function createDomProposal(
    candidate: AICDomDiscoveryCandidate,
    bootstrapSuggestions: AICAuthoringBootstrapSuggestionInput[]
  ): AICAuthoringProposal {
    const proposalKey = `dom:${candidate.key}`;
    const bootstrapMatches = findBootstrapMatches(candidate, bootstrapSuggestions);
    const uniqueBootstrapTargets = Array.from(
      new Set(bootstrapMatches.map((suggestion) => suggestion.target))
    );
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
    const proposal: AICAuthoringProposal = {
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
      appendIssue(
        proposal,
        createIssue(
          "ambiguous_bootstrap_match",
          "Multiple bootstrap suggestions matched this DOM candidate with different target IDs.",
          proposal.key
        ),
        "needs_id_review"
      );
    }

    return proposal;
  }

  function domMatchesRuntimeElement(
    candidate: AICDomDiscoveryCandidate,
    element: AICElementManifest
  ): boolean {
    if (candidate.annotated_agent_id && candidate.annotated_agent_id === element.id) {
      return true;
    }

    return (
      normalizeText(candidate.label) === normalizeText(element.label) &&
      candidate.role === element.role
    );
  }

  const snapshotElements = inputs.snapshot?.elements ?? [];
  const bootstrapSuggestions = normalizeBootstrapSuggestions(inputs.bootstrap_review);
  const proposals: AICAuthoringProposal[] = snapshotElements.map((element) => createSnapshotProposal(element));
  const seenDomKeys = new Set<string>();

  for (const candidate of inputs.dom_candidates ?? []) {
    const duplicateRuntimeElement = snapshotElements.find((element) => domMatchesRuntimeElement(candidate, element));

    if (duplicateRuntimeElement) {
      const recommended_props = {
        agentAction:
          duplicateRuntimeElement.actions[0]?.name ??
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
          createIssue(
            "duplicate_runtime_match",
            "DOM candidate overlaps an existing runtime element and was suppressed.",
            `dom:${candidate.key}`,
            "info"
          )
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
          createIssue(
            "duplicate_dom_candidate",
            "DOM candidate duplicated an earlier authoring candidate.",
            `dom:${candidate.key}`,
            "info"
          )
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
  const groupedByAgentId = new Map<string, AICAuthoringProposal[]>();

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
      appendIssue(
        proposal,
        createIssue(
          "duplicate_proposed_id",
          `Multiple proposals recommend the same agentId "${agentId}".`,
          proposal.key
        ),
        "needs_id_review"
      );
    });
  });

  proposals.forEach((proposal) => {
    setApplyState(
      proposal,
      proposal.source_candidates.filter(
        (candidate) => candidate.match_kind === "agent_id_exact" || candidate.match_kind === "source_inventory_exact"
      )
    );
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
      blocked_by_jsx_pattern: proposals.filter((proposal) =>
        proposal.apply_block_reason ? jsxPatternBlockReasons.has(proposal.apply_block_reason) : false
      ).length,
      bootstrap_backed_proposals: proposals.filter((proposal) => proposal.bootstrap_backed).length,
      ignored: proposals.filter((proposal) => proposal.status === "ignored").length,
      needs_id_review: proposals.filter((proposal) => proposal.status === "needs_id_review").length,
      needs_source_match: proposals.filter((proposal) => proposal.status === "needs_source_match").length,
      ready: proposals.filter((proposal) => proposal.status === "ready").length,
      review_only_metadata: proposals.filter((proposal) =>
        proposal.issues.some((issue) => issue.code === "review_only_object_metadata")
      ).length,
      source_resolved_proposals: proposals.filter((proposal) => proposal.apply_target !== undefined).length,
      total_proposals: proposals.length
    }
  };
}

export function renderAICAuthoringPatchPlanSummary(plan: AICAuthoringPatchPlan): string {
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
    const sourceSummary =
      proposal.source_candidates.length === 1
        ? `${proposal.source_candidates[0].file}:${proposal.source_candidates[0].line}`
        : proposal.source_candidates.length > 1
          ? `${proposal.source_candidates.length} candidates`
          : "no source candidate";
    lines.push(
      `- ${proposal.key} [${proposal.status}/${proposal.apply_status}] -> ${proposal.recommended_props.agentId} (${sourceSummary}${proposal.apply_block_reason ? `; ${proposal.apply_block_reason}` : ""})`
    );
  });

  return lines.join("\n");
}
