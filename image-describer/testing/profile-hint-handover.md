# Profile Hint Optimisation — Handover for Visual Review

## Your role

You are reviewing the output of two small on-device VLMs (FastVLM 0.5B and Qwen3.5 0.8B) that describe images for accessibility alt text. I will show you each test image alongside the VLM outputs. Your job is to:

1. **Score each output against what you actually see** in the image (accuracy, completeness, hallucination)
2. **Recommend prompt tuning** to improve the weakest outputs
3. **Decide whether profile hints help, hurt, or are irrelevant** for each model

---

## Background

### What this is

An accessibility tool that generates alt text for educational images. Users upload an image, optionally select a "profile" (chart, diagram, map, painting, photograph, equation), and the tool runs on-device VLMs to produce a description. There is also a cloud path (OpenRouter API) but this review focuses on the local VLM path only.

### The two models

| Model | Size | Speed | Prompt style |
|-------|------|-------|-------------|
| **FastVLM 0.5B** | 0.5B params | ~5–15s | Single sentence |
| **Qwen3.5 0.8B** | 0.8B params | ~40–55s | Structured 4-section format |

### The "profile hint" mechanism

When a user selects a profile (e.g., "chart"), a hint is prepended to the prompt:

**FastVLM prompt (current):**
```
buildLocalPrompt() {
  const profile = this.getSelectedProfile();
  const hint = profile !== "default"
    ? `This image is a ${profile}. `
    : "";
  return `${hint}Describe this image in detail for accessibility purposes.`;
}
```

**Qwen prompt (current):**
```
buildQwenPrompt() {
  const profile = this.getSelectedProfile();
  const hint = profile !== "default"
    ? `This image is a ${profile}.\n\n`
    : "";
  return (
    hint +
    "Describe this image for accessibility using these sections:\n\n" +
    "## 1. Title\nA brief descriptive title under 10 words.\n\n" +
    "## 2. Alt Text\nOne or two sentences: what the image shows, then its educational significance.\n\n" +
    "## 3. Long Description\nDetailed description of the visual content and its educational purpose.\n\n" +
    "## 4. Text Content\n" +
    'List all visible text exactly as it appears, or write "No text content."'
  );
}
```

### What the automated test found (quantitative)

- **FastVLM + hints: harmful in 4/7 cases.** Hints cause hallucination — the model invents content that matches the hint label rather than describing what it sees.
- **Qwen + hints: neutral.** Neither helps nor hurts noticeably. The structured prompt already constrains output well.
- FastVLM is ~5x faster but less accurate overall.
- Qwen produces better structured, more useful output.

### The open questions for this review

1. **FastVLM:** Should we drop hints entirely, or is there a different hint format that a 0.5B model can use without hallucinating?
2. **Qwen:** Can we craft profile-specific instructions (not just a type label) that improve output quality? E.g., "Focus on axis labels and data trends" for charts.
3. **Are there other prompt changes** (not hint-related) that would improve either model's output?
4. **Is the Qwen 4-section structure optimal**, or would a different structure work better for accessibility descriptions?

---

## Test images and results

Review each image, then compare the 4 outputs (2 models × with/without hint).

---

### Image 1: pv.png
**Assigned profile:** chart
**What to look for:** This is a pressure-volume (PV) thermodynamics diagram.

**FastVLM — no hint:**
> The image depicts a mathematical curve representing a relationship between two variables. The curve starts at the point (1, 2) and decreases as it moves to the right, indicating a negative slope. The point (2, 1) is marked on the curve, suggesting a specific value of the variable being represented. The curve is labeled with the variable "δV" and an arrow indicating the direction of the change. The overall shape of the curve suggests a decreasing trend, which is typical in mathematical models where the dependent variable decreases as the independent variable increases.

**FastVLM — with hint ("This image is a chart."):**
> The image depicts a simple mechanical system, specifically a lever, with a vertical rod labeled as "1" and a horizontal rod labeled as "2" connected by a fulcrum labeled as "V". The lever is shown in a state of motion, with the fulcrum "V" at a certain distance from the fulcrum of the horizontal rod. The lever is in a state of motion, with the lever arm "1" moving towards the fulcrum "V" and the lever arm "2" moving away from the fulcrum "V". The angle between the lever arm "1" and the horizontal axis is labeled as "δV". The image is a representation of a mechanical system, likely used for educational purposes to illustrate concepts such as motion, forces, and equilibrium. The diagram is a basic representation, without any additional details or annotations.

**Qwen — no hint:**
> ### 1. Title
> A pressure-volume curve showing how pressure decreases as volume increases.
>
> ### 2. Alt Text
> This image displays a pressure-volume (P-V) curve, illustrating a relationship where pressure decreases as volume increases. The curve is labeled with a change in volume represented by δV, and two specific points are marked on the x-axis (volume axis) at volumes of 2 and 1.
>
> ### 3. Long Description
> The image presents a graph of a pressure-volume curve, which is a fundamental concept in thermodynamics. The curve shows that pressure (P) decreases as volume (V) increases, indicating an inverse relationship between the two variables. The curve is curved, suggesting that the relationship is not linear. The x-axis represents volume, and the y-axis represents pressure. The curve has two distinct points marked on the x-axis, labeled with the values 2 and 1. The change in volume between these points is indicated by the symbol δV, which helps visualize the infinitesimal change in volume. This graph is useful for understanding how pressure changes with volume in various physical systems, such as gases or liquids.
>
> ### 4. Text Content
> No text content.

**Qwen — with hint ("This image is a chart."):**
> ### 1. Title
> P-V Curve Graph
>
> ### 2. Alt Text
> A P-V diagram showing a pressure-volume curve with a specific change indicated by a delta V segment between two points labeled with their respective coordinates.
>
> ### 3. Long Description
> The image displays a pressure-volume (P-V) graph where the vertical axis represents pressure (P) and the horizontal axis represents volume (V). The curve illustrates a relationship between these two variables, decreasing as volume increases. A key feature is the vertical segment labeled with delta V, indicating a change in volume. The points on the curve are marked with coordinates: one point is at volume 2, and another is at volume 1. This visual representation helps in understanding how pressure changes with volume in a system, such as a gas or fluid, and is useful for analyzing thermodynamic processes.
>
> ### 4. Text Content
> P, V, 2, 1, delta V, V, P, V, 2, 1

---

### Image 2: piston.png
**Assigned profile:** diagram
**What to look for:** This is a diagram of a piston/cylinder with gas particles inside.

**FastVLM — no hint:**
> The image depicts a cylindrical container filled with a liquid. The liquid has small, red, spherical particles distributed throughout. At the top of the container, there is a blue arrow pointing upwards, indicating the direction of the fluid flow. The liquid level is marked by a red arrow pointing downwards, suggesting that the fluid is being drawn into the container. The container has a flat bottom and a slightly curved top, creating a stable structure. The red particles are likely representing bubbles or droplets, indicating the presence of air or gas within the liquid. The overall scene suggests a process of liquid being poured or drawn into the container, with the red particles indicating the movement of the liquid.

**FastVLM — with hint ("This image is a diagram."):**
> The image depicts a simplified diagram of a glass beaker containing a liquid. The liquid is represented by a transparent body with red dots indicating bubbles. The beaker is topped with a blue cap, and there is a red arrow pointing upwards from the liquid, suggesting an increase in pressure or volume. The diagram is labeled with the letters "P" and "V" indicating pressure and volume, respectively. The overall structure is a basic representation of a container used for holding liquids, with the liquid being the central element. The diagram is likely used to illustrate concepts related to pressure, volume, and the behavior of liquids.

**Qwen — no hint:**
> ### 1. Title
> A diagram illustrating a piston moving upward in a cylinder.
>
> ### 2. Alt Text
> This diagram shows a cylinder with a piston moving upward, indicating a process where volume increases. The red dots represent gas particles, and the arrows indicate the direction of the force or movement.
>
> ### 3. Long Description
> The image displays a schematic of a cylinder containing a gas, represented by red dots inside a white container. A gray cylinder with a piston is shown, and an arrow labeled "P.V" points upward from the top surface of the cylinder, indicating the direction of the force exerted by the gas on the piston. Another arrow labeled "Q" points to the left, suggesting the direction of the force applied to the piston. A blue arrow labeled "U" points upward, indicating the direction of the piston's movement. The red dots represent gas particles, and the arrows indicate the direction of the force or movement. This diagram illustrates a process where volume increases, as shown by the upward movement of the piston.
>
> ### 4. Text Content
> No text content.

**Qwen — with hint ("This image is a diagram."):**
> ### 1. Title
> A diagram illustrating a piston moving upward in a cylinder.
>
> ### 2. Alt Text
> This diagram shows a cylinder with a piston moving upward, indicating a process where volume increases. The red dots represent gas particles, and the arrows indicate the direction of the movement. This is used to explain concepts like gas pressure, volume, and the relationship between these variables in physics.
>
> ### 3. Long Description
> The image displays a schematic of a cylinder containing a gas. A red arrow labeled 'Q' points to the left, indicating the direction of a force or pressure applied to the gas. A blue arrow labeled 'P.V' points upward, showing the direction of the gas's movement. Inside the cylinder, numerous red dots represent gas particles. A gray cylinder is labeled 'P.V', and a white cylinder labeled 'U' is shown below it. The red dots are scattered within the white cylinder, suggesting that the gas is confined within the cylinder's volume. The overall layout helps visualize how the gas's properties change as it moves, which is crucial for understanding concepts such as pressure, volume, and the relationship between these variables in physics.
>
> ### 4. Text Content
> Q, P.V, U

---

### Image 3: Proposed mechanism of action of GA.png
**Assigned profile:** diagram
**What to look for:** A biological mechanism diagram showing immune cell interactions (macrophages, microglia, T-cells, cytokines).

**FastVLM — no hint:**
> The image depicts a simplified diagram of the human circulatory system, specifically focusing on the mechanisms of blood flow and the role of the heart. On the left side of the image, the diagram shows the macrophage, which is a type of white blood cell, interacting with the microglia, which are the cells in the brain. The macrophage is shown releasing a substance into the bloodstream, which then travels through the bloodstream to the microglia. [...] The substances released into the bloodstream include blood, blood-brain barrier, and CNS Ag (Antinucleus of Cerebellar GABA). The diagram also shows the release of substances into the bloodstream, including IL-4, IL-10, and BDNF.

**FastVLM — with hint ("This image is a diagram."):**
> The image provided is a diagram that illustrates the process of blood-brain barrier (BBM) formation in the context of neural tissue. The diagram is divided into two sections, each depicting a different type of barrier: a macrophage barrier and a microglia barrier. [...] The membrane structure is different, with a membrane hole (MHOC) and a membrane channel (MHCT) that allows for the passage of substances.

**Qwen — no hint:**
> ### 1. Title
> Peripheral and CNS immune cell interactions illustrated.
>
> ### 2. Alt Text
> This diagram illustrates the interaction between peripheral immune cells (T cells) and central nervous system (CNS) cells (microglia) during the process of immune regulation. It depicts how GAT-hydroxyapatite (GA) therapy influences the activation of Th1 and Th2 cells, leading to a shift in the brain's immune environment from a bystander suppression state to neuroprotection.
>
> ### 3. Long Description
> [...] On the left side, labeled "periphery," it shows a T cell (red circle) interacting with a macrophage (green circle) via TCR (T-cell receptor) and MHC molecules. The interaction is mediated by Ga, which is visualized as a blue molecule connecting the macrophage to the T cell. [...] On the right side, labeled "CNS," it shows a microglia (purple circle) interacting with another T cell (green circle) via TCR and MHC molecules. [...]
>
> ### 4. Text Content
> periphery, macrophage, MHC, GA, T-cell, TH 1, TH 2, CNS, microglia, T-cell, MHC, CNS Ag, T-cell, IL-4, Antiinflammatory cytokines, BDNF, neuroprotection, bystander suppression, Th1, Th2

**Qwen — with hint ("This image is a diagram."):**
> [Very similar to no-hint, with minor wording differences and slightly expanded cytokine list including IL-10]

---

### Image 4: Siège_de_Rouen_(1418-1419).jpg
**Assigned profile:** painting
**What to look for:** A medieval illuminated manuscript painting depicting the Siege of Rouen (1418–1419).

**FastVLM — no hint:**
> The image depicts a medieval scene, likely from the 14th century, showcasing a castle and a battle. The castle is prominently featured on the right side of the image, characterized by its tall, cylindrical structure with a conical roof. [...] In the foreground, there is a cannon positioned on the left side of the image [...] The background of the image shows a battle scene with soldiers engaged in combat. [...] The image is framed by a golden border, giving it a sense of completeness and focus on the central scene.

**FastVLM — with hint ("This image is a painting."):**
> The image is a painting that depicts a medieval scene. The painting is divided into two main sections: the left side shows a castle with a castle tower, and the right side shows a castle with a castle tower. The castle on the left has a red roof and a wooden door, while the castle on the right has a brown door. [...] The painting is a detailed and colorful representation of a medieval castle scene.

**Qwen — no hint:**
> [...] This image depicts a historical illustration of a fortified castle, likely from the Middle Ages or early modern period, featuring multiple towers, turrets, and defensive walls. Several cannons are firing projectiles along a river, suggesting military operations or defense. [...]

**Qwen — with hint ("This image is a painting."):**
> [...] This is a colorful illustration depicting a medieval castle surrounded by tents and soldiers. Cannons are firing into a river, suggesting a battle or siege. The artwork is likely educational, illustrating historical military tactics or architectural styles. [...]

---

### Image 5: Probability_of_exceedance__intensity_.jpg
**Assigned profile:** chart
**What to look for:** An engineering chart showing probability of exceedance curves with return period vs service life.

**FastVLM — no hint:**
> The image is a graphical representation of the probability of exceeding service life for various types of infrastructure. [...] [Then hallucinated identical formulae for all 4 categories, and degenerated into repeating "0" characters]

**FastVLM — with hint ("This image is a chart."):**
> The image provided is a chart titled "Probability of excessage." [...] The chart is divided into four scenarios: Buildings, Power stations, Industrial stations, Dams [...] The probability of excessage is calculated using the formula: p = 1 - (1 - 1/T)^t [...]

**Qwen — no hint:**
> [...] This chart illustrates the probability of exceedance (intensity) of a system's return period over its service life, categorized by the probability of exceedance (p) and the service life (t) in years. [...] The mathematical formula p = 1 - (1 - 1/T)^c is displayed in the center [...]

**Qwen — with hint ("This image is a chart."):**
> [...] [Very similar to no-hint, with slightly more detail about axis ranges and categories]

---

### Image 6: Bacteria_on_an_agar_plate.jpg
**Assigned profile:** diagram
**What to look for:** A photograph of an agar plate showing antibiotic disk diffusion with zones of inhibition and resistance mutant colonies.

**FastVLM — no hint:**
> The image is a scientific illustration depicting the structure of a bacterial cell. It shows a cross-section of a bacterial cell with labels indicating different zones and regions. The labeled areas include: Zone of Inhibition, Antibiotic Disk, Resistance Mutants [...]

**FastVLM — with hint ("This image is a diagram."):**
> The image provided is a scientific diagram illustrating the structure of a bacterial cell. [...] [Became very repetitive — items 1-10 repeating the same 3 descriptions in a loop]

**Qwen — no hint:**
> ### 1. Title
> Antibiotic Disk Growth Experiment
>
> ### 2. Alt Text
> This image illustrates a classic microbiology experiment showing how antibiotics affect bacterial growth. It displays a central antibiotic disk surrounded by a zone of inhibition, with several resistance mutants located on the disk. [...]
>
> ### 4. Text Content
> Zone of inhibition, Antibiotic disk, Resistance mutants

**Qwen — with hint ("This image is a diagram."):**
> [Nearly identical to no-hint]

---

### Image 7: Indian_Ocean_Tsunami.png
**Assigned profile:** map
**What to look for:** A map of the Indian Ocean showing death tolls by country from the 2004 tsunami.

**FastVLM — no hint:**
> The image is a map of the Indian Ocean, highlighting the 2004 Indian Ocean Tsunami that occurred in the region. The map shows the geographical distribution of the tsunami's impact, with the number of deaths and deaths due to the tsunami indicated in different colors. India: 16,389 [...] Indonesia: 165,708 [...]

**FastVLM — with hint ("This image is a map."):**
> The image is a map that illustrates the 2004 Indian Ocean Tsunami that occurred in the region. [...] [Similar content, more structured, but hit token limit before finishing]

**Qwen — no hint:**
> [...] The chart shows the death toll from the 2004 Indian Ocean Tsunami by country and region, with corresponding numbers. [...] Indonesia: 165,708 deaths, Sri Lanka: 35,399 deaths, India: 16,389 deaths [...]

**Qwen — with hint ("This image is a map."):**
> [...] [Very similar, slight wording differences]

---

## What I'd like from this review

For each image, please:

1. **Accuracy score (1-5)** for each of the 4 outputs, based on what you see in the actual image
2. **Hallucination flag** — note any claims that are clearly wrong
3. **Missing content** — important visual elements that no output captured

Then, across all images:

4. **FastVLM recommendation:** Drop hints entirely, or propose an alternative hint format that might work for a 0.5B model?
5. **Qwen recommendation:** Propose profile-specific instruction text (not just type labels) if you think it would help. For example, for charts: "Pay attention to axis labels, data values, trends, and the legend." Only propose this if you think it would measurably improve the output — "good enough" is a valid answer.
6. **Structural recommendations:** Any changes to the Qwen 4-section format, or the FastVLM single-sentence prompt, that would improve accessibility description quality?
7. **Profile-specific guidance:** For each of the 7 profiles (chart, diagram, map, painting, photograph, equation, default), suggest optimised hint/instruction text — or "none" if the unhinted prompt is best.

### Constraints to keep in mind

- These are tiny on-device models (0.5B and 0.8B) — they cannot follow complex multi-step instructions reliably
- Longer prompts = slower generation (especially Qwen at ~45s already)
- The output is used as a *starting point* for accessibility descriptions, not as final text — "mostly right" is valuable
- The profile is either user-selected or auto-detected by CLIP classification — it may occasionally be wrong, so hints must not catastrophically degrade output when the profile is incorrect
