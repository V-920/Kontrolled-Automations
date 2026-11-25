const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export function normalizeWorkflow(input) {
    let workflow = input;
    if (typeof workflow === "string") {
        try {
            workflow = JSON.parse(workflow);
        }
        catch {
            throw new Error("Workflow must be valid JSON.");
        }
    }
    if (workflow && typeof workflow === "object" && workflow.workflow)
        workflow = workflow.workflow;
    if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
        throw new Error("Workflow must be a JSON object.");
    }
    return workflow;
}
export function validateWorkflow(input) {
    const errors = [];
    const warnings = [];
    let workflow;
    try {
        workflow = normalizeWorkflow(input);
    }
    catch (error) {
        return { valid: false, errors: [error.message], warnings: [] };
    }
    if (typeof workflow.name !== "string" || !workflow.name.trim())
        errors.push("Workflow name is required.");
    if (!Array.isArray(workflow.nodes))
        errors.push("Workflow nodes must be an array.");
    if (!workflow.connections || typeof workflow.connections !== "object" || Array.isArray(workflow.connections)) {
        errors.push("Workflow connections must be an object.");
    }
    if (Array.isArray(workflow.nodes)) {
        if (workflow.nodes.length === 0)
            warnings.push("The workflow has no nodes.");
        const names = new Set();
        workflow.nodes.forEach((node, index) => {
            if (!node || typeof node !== "object" || Array.isArray(node)) {
                errors.push(`Node ${index + 1} must be an object.`);
                return;
            }
            if (typeof node.name !== "string" || !node.name.trim())
                errors.push(`Node ${index + 1} is missing a name.`);
            else if (names.has(node.name))
                errors.push(`Duplicate node name: ${node.name}.`);
            else
                names.add(node.name);
            if (typeof node.type !== "string" || !node.type.trim())
                errors.push(`Node ${index + 1} (${node.name || "unnamed"}) is missing a type.`);
            if (!node.parameters || typeof node.parameters !== "object" || Array.isArray(node.parameters)) {
                warnings.push(`Node ${node.name || index + 1} has no parameters object.`);
            }
            if (node.credentials && (typeof node.credentials !== "object" || Array.isArray(node.credentials)))
                errors.push(`Node ${node.name} has an invalid credentials field.`);
            if (node.position !== undefined && (!Array.isArray(node.position) || node.position.length !== 2 || !node.position.every(Number.isFinite)))
                errors.push(`Node ${node.name || index + 1} has an invalid position.`);
            for (const key of Object.keys(node))
                if (FORBIDDEN_KEYS.has(key))
                    errors.push(`Node ${index + 1} contains a prohibited property.`);
        });
        if (Array.isArray(workflow.nodes) && workflow.nodes.length > 250)
            errors.push("Workflows are limited to 250 nodes in this MVP.");
    }
    if (Array.isArray(workflow.nodes) && workflow.connections && typeof workflow.connections === "object") {
        const nodeNames = new Set(workflow.nodes.filter(n => n && typeof n.name === "string").map(n => n.name));
        for (const [source, outputs] of Object.entries(workflow.connections)) {
            if (!nodeNames.has(source))
                errors.push(`Connection source "${source}" does not exist.`);
            if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
                errors.push(`Connections for "${source}" must be an object.`);
                continue;
            }
            for (const [kind, branches] of Object.entries(outputs)) {
                if (!Array.isArray(branches)) {
                    errors.push(`Connection group "${source}.${kind}" must be an array.`);
                    continue;
                }
                for (const branch of branches) {
                    if (!Array.isArray(branch)) {
                        errors.push(`Connection branch "${source}.${kind}" is invalid.`);
                        continue;
                    }
                    for (const edge of branch) {
                        if (!edge || typeof edge.node !== "string" || !nodeNames.has(edge.node))
                            errors.push(`Connection from "${source}" points to a missing node.`);
                        if (edge?.type && edge.type !== kind)
                            errors.push(`Connection from "${source}" has a type mismatch (${kind}/${edge.type}).`);
                        if (edge && (!Number.isInteger(edge.index) || edge.index < 0))
                            errors.push(`Connection from "${source}" has an invalid output index.`);
                    }
                }
            }
        }
    }
    if (Array.isArray(workflow.nodes) && workflow.nodes.length) {
        const hasTrigger = workflow.nodes.some(n => /trigger/i.test(n?.type || "") || ["n8n-nodes-base.webhook", "n8n-nodes-base.manualTrigger"].includes(n?.type));
        if (!hasTrigger)
            warnings.push("No recognizable trigger node was detected. Confirm how this workflow starts.");
    }
    if (Array.isArray(workflow.nodes)) {
        for (const node of workflow.nodes)
            if (node?.credentials && Object.keys(node.credentials).length)
                warnings.push(`Node "${node.name}" requires credentials configured in the destination n8n instance.`);
    }
    if (workflow.active === true)
        warnings.push("Activation is not performed by this MVP. New workflows are created inactive.");
    return { valid: errors.length === 0, errors, warnings, workflow };
}
export function toN8nCreatePayload(input) {
    const result = validateWorkflow(input);
    if (!result.valid)
        throw new Error(result.errors.join(" "));
    const w = result.workflow;
    // Send only the fields required for workflow creation. Never pass an imported ID or active state.
    return {
        name: w.name,
        nodes: w.nodes,
        connections: w.connections,
        ...(w.settings && typeof w.settings === "object" ? { settings: w.settings } : {})
    };
}
