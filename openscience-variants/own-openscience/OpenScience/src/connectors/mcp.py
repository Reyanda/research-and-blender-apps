"""
OpenScience MCP Connector Registry
Complete 60+ connectors matching original Claude Science app.
"""

from typing import Dict, Optional, Any

# All MCP connectors from original Claude Science / Operon app

MCP_CONNECTORS = {
    # ===== PubMed & Literature =====
    "pubmed": {
        "name": "PubMed",
        "description": "PubMed biomedical literature — search, metadata, abstracts, full-text (PMC), related articles, ID conversion",
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "enabled": True,
        "category": "literature"
    },
    "europe-pmc": {
        "name": "Europe PMC",
        "description": "Europe PMC literature search with full-text access",
        "base_url": "https://www.ebi.ac.uk/europepmc/webservices/rest",
        "enabled": True,
        "category": "literature"
    },
    "openalex": {
        "name": "OpenAlex",
        "description": "Scholarly literature graph — works, authors, venues, citations",
        "base_url": "https://api.openalex.org",
        "enabled": True,
        "category": "literature"
    },
    "crossref": {
        "name": "Crossref",
        "description": "DOI registry and citation metadata",
        "base_url": "https://api.crossref.org",
        "enabled": True,
        "category": "literature"
    },
    "semantic-scholar": {
        "name": "Semantic Scholar",
        "description": "AI-powered research paper search and citation graph",
        "base_url": "https://api.semanticscholar.org/graph/v1",
        "enabled": True,
        "category": "literature"
    },
    "biorxiv": {
        "name": "bioRxiv",
        "description": "bioRxiv/medRxiv preprints — search, metadata, published links, funder search",
        "base_url": "https://api.biorxiv.org/details/biorxiv",
        "enabled": True,
        "category": "literature"
    },
    "arxiv": {
        "name": "arXiv",
        "description": "arXiv preprints for quantitative sciences",
        "base_url": "https://export.arxiv.org/api/query",
        "enabled": True,
        "category": "literature"
    },
    "litcovid": {
        "name": "LitCovid",
        "description": "COVID-19 literature collection from PubMed",
        "base_url": "https://www.ncbi.nlm.nih.gov/research/coronavirus-api",
        "enabled": True,
        "category": "literature"
    },
    "cochrane": {
        "name": "Cochrane Library",
        "description": "Systematic reviews and clinical trial evidence",
        "base_url": "https://www.cochranelibrary.com",
        "enabled": True,
        "category": "literature"
    },

    # ===== Genomics & Genetics =====
    "ensembl": {
        "name": "Ensembl",
        "description": "Genome annotation — lookup, sequence, homology, VEP",
        "base_url": "https://rest.ensembl.org",
        "enabled": True,
        "category": "genomics"
    },
    "ensembl-biomart": {
        "name": "Ensembl BioMart",
        "description": "Genomic annotations, identifier translation, and cross-reference queries",
        "base_url": "https://www.ensembl.org/biomart/martservice",
        "enabled": True,
        "category": "genomics"
    },
    "ncbi-gene": {
        "name": "NCBI Gene",
        "description": "Gene identity and information from NCBI Entrez",
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "enabled": True,
        "category": "genomics"
    },
    "gnomad": {
        "name": "gnomAD",
        "description": "Population frequencies and constraint scores (r4)",
        "base_url": "https://gnomad.broadinstitute.org/api",
        "enabled": True,
        "category": "genomics"
    },
    "gtex": {
        "name": "GTEx",
        "description": "Gene expression and eQTLs across tissues",
        "base_url": "https://gtexportal.org/api/v2",
        "enabled": True,
        "category": "genomics"
    },
    "encode": {
        "name": "ENCODE",
        "description": "Gene regulation — experiments, files, biosamples",
        "base_url": "https://www.encodeproject.org/api",
        "enabled": True,
        "category": "genomics"
    },
    "gwas": {
        "name": "GWAS Catalog",
        "description": "Human genetic associations from GWAS studies",
        "base_url": "https://www.ebi.ac.uk/gwas/rest/api",
        "enabled": True,
        "category": "genomics"
    },
    "eqtl-catalogue": {
        "name": "eQTL Catalogue",
        "description": "eQTL summary statistics across tissues",
        "base_url": "https://www.ebi.ac.uk/eqtl/api",
        "enabled": True,
        "category": "genomics"
    },
    "finngen": {
        "name": "FinnGen",
        "description": "FinnGen PheWAS portal for Finnish population",
        "base_url": "https://r13.finngen.fi/api",
        "enabled": True,
        "category": "genomics"
    },
    "clinvar": {
        "name": "ClinVar",
        "description": "Clinical significance of genetic variants",
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "enabled": True,
        "category": "genomics"
    },
    "dbsnp": {
        "name": "dbSNP",
        "description": "Short genetic variations database",
        "base_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        "enabled": True,
        "category": "genomics"
    },
    "ucsc": {
        "name": "UCSC Genome Browser",
        "description": "Genome tracks and conservation data",
        "base_url": "https://api.genome.ucsc.edu",
        "enabled": True,
        "category": "genomics"
    },
    "rfam": {
        "name": "Rfam",
        "description": "Non-coding RNA families, seed alignments, covariance models",
        "base_url": "https://rfam.org/api",
        "enabled": True,
        "category": "genomics"
    },

    # ===== Proteomics =====
    "uniprot": {
        "name": "UniProt",
        "description": "Protein sequence and functional information",
        "base_url": "https://rest.uniprot.org",
        "enabled": True,
        "category": "proteomics"
    },
    "alphafold": {
        "name": "AlphaFold",
        "description": "AI-predicted protein structures",
        "base_url": "https://alphafold.ebi.ac.uk/api",
        "enabled": True,
        "category": "proteomics"
    },
    "pdb": {
        "name": "RCSB PDB",
        "description": "Protein Data Bank — 3D structural data",
        "base_url": "https://data.rcsb.org/rest/v1",
        "enabled": True,
        "category": "proteomics"
    },
    "string": {
        "name": "STRING",
        "description": "Protein-protein interaction networks",
        "base_url": "https://string-db.org/api",
        "enabled": True,
        "category": "proteomics"
    },
    "interpro": {
        "name": "InterPro",
        "description": "Protein domains, families, and functional sites",
        "base_url": "https://www.ebi.ac.uk/interpro/api",
        "enabled": True,
        "category": "proteomics"
    },
    "pfam": {
        "name": "Pfam",
        "description": "Protein families and domains",
        "base_url": "https://www.ebi.ac.uk/interpro/api",
        "enabled": True,
        "category": "proteomics"
    },
    "protein-atlas": {
        "name": "Human Protein Atlas",
        "description": "Tissue-specific protein expression and localization",
        "base_url": "https://www.proteinatlas.org/api",
        "enabled": True,
        "category": "proteomics"
    },
    "foldseek": {
        "name": "Foldseek",
        "description": "Protein structure search and comparison",
        "base_url": "https://search.foldseek.com/api",
        "enabled": True,
        "category": "proteomics"
    },
    "pdb": {
        "name": "PDB",
        "description": "Protein Data Bank structures",
        "base_url": "https://data.rcsb.org/rest/v1",
        "enabled": True,
        "category": "proteomics"
    },
    "emdb": {
        "name": "EMDB",
        "description": "Cryo-EM structure data",
        "base_url": "https://www.ebi.ac.uk/emdb/api",
        "enabled": True,
        "category": "proteomics"
    },
    "complex-portal": {
        "name": "Complex Portal",
        "description": "Protein complex annotations",
        "base_url": "https://www.ebi.ac.uk/intact/ws/complex",
        "enabled": True,
        "category": "proteomics"
    },
    "intact": {
        "name": "IntAct",
        "description": "Molecular interaction networks",
        "base_url": "https://www.ebi.ac.uk/intact/ws/interaction",
        "enabled": True,
        "category": "proteomics"
    },
    "pride": {
        "name": "PRIDE",
        "description": "Proteomics data repository",
        "base_url": "https://www.ebi.ac.uk/pride/ws/archive/api",
        "enabled": True,
        "category": "proteomics"
    },

    # ===== Pathways & Functions =====
    "kegg": {
        "name": "KEGG",
        "description": "Pathway and genome database",
        "base_url": "https://rest.kegg.jp",
        "enabled": True,
        "category": "pathways"
    },
    "reactome": {
        "name": "Reactome",
        "description": "Biological pathway knowledgebase",
        "base_url": "https://reactome.org/ContentService",
        "enabled": True,
        "category": "pathways"
    },
    "go": {
        "name": "Gene Ontology",
        "description": "GO annotations and ontology terms via QuickGO/OLS4",
        "base_url": "https://api.geneontology.org/api",
        "enabled": True,
        "category": "pathways"
    },
    "mygene": {
        "name": "MyGene.info",
        "description": "Gene query and annotation service",
        "base_url": "https://mygene.info/v3",
        "enabled": True,
        "category": "pathways"
    },
    "jaspar": {
        "name": "JASPAR",
        "description": "Transcription factor binding matrix profiles",
        "base_url": "https://jaspar.elixir.no/api",
        "enabled": True,
        "category": "pathways"
    },
    "unibind": {
        "name": "UniBind",
        "description": "Curated transcription factor binding sites",
        "base_url": "https://unibind.unil.ch/api",
        "enabled": True,
        "category": "pathways"
    },

    # ===== Chemistry & Drugs =====
    "chembl": {
        "name": "ChEMBL",
        "description": "Bioactivity database — compounds, drugs, targets, ADMET",
        "base_url": "https://www.ebi.ac.uk/chembl/api/data",
        "enabled": True,
        "category": "chemistry"
    },
    "pubchem": {
        "name": "PubChem",
        "description": "Chemical compounds, properties, similarity search",
        "base_url": "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
        "enabled": True,
        "category": "chemistry"
    },
    "chebi": {
        "name": "ChEBI",
        "description": "Chemical Entities of Biological Interest ontology",
        "base_url": "https://www.ebi.ac.uk/chebi/ws/chebi",
        "enabled": True,
        "category": "chemistry"
    },
    "rhea": {
        "name": "Rhea",
        "description": "Chemical and biological reactions database",
        "base_url": "https://www.rhea-db.org/api",
        "enabled": True,
        "category": "chemistry"
    },
    "bindingdb": {
        "name": "BindingDB",
        "description": "Binding affinity data for proteins and small molecules",
        "base_url": "https://www.bindingdb.org/rbd",
        "enabled": True,
        "category": "chemistry"
    },
    "zinc": {
        "name": "ZINC22",
        "description": "Purchasable chemical space — compound lookup, SMILES search, docking",
        "base_url": "https://zinc.docking.org",
        "enabled": True,
        "category": "chemistry"
    },
    "drugbank": {
        "name": "DrugBank",
        "description": "Drug and drug target database",
        "base_url": "https://go.drugbank.com/releases/latest",
        "enabled": True,
        "category": "chemistry"
    },

    # ===== Clinical =====
    "clinical-trials": {
        "name": "ClinicalTrials.gov",
        "description": "Trial search, details, endpoints, eligibility",
        "base_url": "https://clinicaltrials.gov/api/v2",
        "enabled": True,
        "category": "clinical"
    },
    "fda": {
        "name": "FDA",
        "description": "Drugs@FDA applications, approvals, pharmacologic classes, SPL labels",
        "base_url": "https://api.fda.gov/drug",
        "enabled": True,
        "category": "clinical"
    },
    "open-targets": {
        "name": "Open Targets",
        "description": "Drug target discovery and prioritisation platform",
        "base_url": "https://api.platform.opentargets.org/api/v4/graphql",
        "enabled": True,
        "category": "clinical"
    },
    "cosmic": {
        "name": "COSMIC",
        "description": "Catalogue of somatic mutations in cancer",
        "base_url": "https://cancer.sanger.ac.uk/cosmic/api",
        "enabled": True,
        "category": "clinical"
    },
    "clingen": {
        "name": "ClinGen",
        "description": "Gene validity, dosage, actionability curations",
        "base_url": "https://search.clinicalgenome.org/kb/api",
        "enabled": True,
        "category": "clinical"
    },
    "civic": {
        "name": "CIViC",
        "description": "Clinical interpretation of variants in cancer",
        "base_url": "https://civicdb.org/api/v1",
        "enabled": True,
        "category": "clinical"
    },

    # ===== Microbiome & Metagenomics =====
    "mg-rast": {
        "name": "MG-RAST",
        "description": "Metagenomics analysis server",
        "base_url": "https://api.mg-rast.org",
        "enabled": True,
        "category": "microbiome"
    },
    "ebi-metagenomics": {
        "name": "EBI Metagenomics",
        "description": "Metagenomics analysis and data",
        "base_url": "https://www.ebi.ac.uk/ebi_metagenomics/api",
        "enabled": True,
        "category": "microbiome"
    },
    "mgnify": {
        "name": "MGnify",
        "description": "Microbiome analysis pipeline",
        "base_url": "https://www.ebi.ac.uk/ebi_metagenomics/api",
        "enabled": True,
        "category": "microbiome"
    },

    # ===== Cell & Single Cell =====
    "cellguide": {
        "name": "CellGuide",
        "description": "Cell type information from CELLxGENE — descriptions, markers, tissue",
        "base_url": "https://cellxgene.cziscience.com/api",
        "enabled": True,
        "category": "cell"
    },

    # ===== Cancer =====
    "cancer-models": {
        "name": "Cancer Models",
        "description": "cBioPortal studies, mutations, copy-number alterations, clinical attributes",
        "base_url": "https://www.cbioportal.org/api",
        "enabled": True,
        "category": "cancer"
    },

    # ===== Omics Archives =====
    "arrayexpress": {
        "name": "ArrayExpress",
        "description": "Functional genomics data repository",
        "base_url": "https://www.ebi.ac.uk/arrayexpress/api",
        "enabled": True,
        "category": "omics"
    },
    "geo": {
        "name": "GEO",
        "description": "Gene Expression Omnibus",
        "base_url": "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi",
        "enabled": True,
        "category": "omics"
    },

    # ===== Funding & Resources =====
    "grants-gov": {
        "name": "Grants.gov",
        "description": "Federal grant opportunities search",
        "base_url": "https://www.grants.gov/grantsws/opp/search",
        "enabled": True,
        "category": "resources"
    },
    "antibody-registry": {
        "name": "Antibody Registry",
        "description": "Antibody identifiers and validation",
        "base_url": "https://antibodyregistry.org/api",
        "enabled": True,
        "category": "resources"
    },
}


# Entries with a concrete search adapter; registry presence alone is metadata.
SEARCH_CONNECTORS = frozenset(['alphafold', 'antibody-registry', 'arrayexpress', 'arxiv', 'bindingdb', 'cancer-models', 'cellguide', 'chebi', 'chembl', 'civic', 'clingen', 'clinical-trials', 'clinvar', 'complex-portal', 'cosmic', 'crossref', 'dbsnp', 'emdb', 'encode', 'ensembl', 'ensembl-biomart', 'eqtl-catalogue', 'fda', 'finngen', 'foldseek', 'geo', 'gnomad', 'go', 'grants-gov', 'gtex', 'gwas', 'intact', 'interpro', 'jaspar', 'kegg', 'mgnify', 'mygene', 'ncbi-gene', 'open-targets', 'openalex', 'pdb', 'pfam', 'pride', 'protein-atlas', 'pubchem', 'pubmed', 'reactome', 'rfam', 'rhea', 'semantic-scholar', 'string', 'ucsc', 'unibind', 'uniprot', 'zinc'])

# MCP Connector search function
async def mcp_search(connector_id: str, query: str, params: Dict = None) -> Dict:
    """Generic MCP connector search"""
    import httpx
    from datetime import datetime, timedelta
    
    connector = MCP_CONNECTORS.get(connector_id)
    if not connector or not connector["enabled"]:
        return {"error": f"Connector {connector_id} not available"}
    
    try:
        maximum = int((params or {}).get("max_results", 10))
        if not 1 <= maximum <= 100:
            return {"error": "max_results must be between 1 and 100"}
    except (ValueError, TypeError):
        return {"error": "max_results must be an integer"}
    base_url = connector["base_url"]
    from urllib.parse import quote
    raw_query = query
    # Identifiers inserted in a URL must remain one path segment.
    query = quote(query, safe="") if connector_id in {
        "alphafold", "ensembl", "pubchem", "chebi", "interpro", "protein-atlas",
        "cancer-models", "zinc", "pfam", "unibind", "gtex", "go", "kegg"
    } else query
    
    try:
        async with httpx.AsyncClient() as client:
            # PubMed
            if connector_id == "pubmed":
                resp = await client.get(f"{base_url}/esearch.fcgi", params={
                    "db": "pubmed", "term": query, "retmax": maximum, "retmode": "json"
                }, timeout=30.0)
                data = resp.json()
                ids = data.get("esearchresult", {}).get("idlist", [])
                if ids:
                    detail = await client.get(f"{base_url}/esummary.fcgi", params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"}, timeout=30.0)
                    articles = detail.json().get("result", {})
                    return {"results": [{"pmid": k, "title": v.get("title", ""), "authors": [a.get("name", "") for a in v.get("authors", [])[:3]], "journal": v.get("fulljournalname", ""), "pubdate": v.get("pubdate", "")} for k, v in articles.items() if isinstance(v, dict)]}
                return {"results": [], "total": 0}
            
            # Clinical Trials
            elif connector_id == "clinical-trials":
                resp = await client.get(f"{base_url}/studies", params={"query.term": query, "pageSize": maximum, "format": "json"}, timeout=30.0)
                data = resp.json()
                return {"results": [{"nct_id": s.get("protocolSection", {}).get("identificationModule", {}).get("nctId", ""), "title": s.get("protocolSection", {}).get("identificationModule", {}).get("briefTitle", ""), "status": s.get("protocolSection", {}).get("statusModule", {}).get("overallStatus", "")} for s in data.get("studies", [])[:10]]}
            
            # ChEMBL
            elif connector_id == "chembl":
                resp = await client.get(f"{base_url}/molecule/search", params={"q": query, "limit": 10, "format": "json"}, timeout=30.0)
                data = resp.json()
                return {"results": [{"chembl_id": m.get("molecule_chembl_id", ""), "name": m.get("pref_name", ""), "type": m.get("molecule_type", "")} for m in data.get("molecules", [])[:10]]}
            
            # UniProt
            elif connector_id == "uniprot":
                resp = await client.get(f"{base_url}/uniprotkb/search", params={"query": query, "size": 10, "format": "json"}, timeout=30.0)
                data = resp.json()
                return {"results": [{"accession": r.get("primaryAccession", ""), "name": r.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value", ""), "organism": r.get("organism", {}).get("scientificName", "")} for r in data.get("results", [])[:10]]}
            
            # AlphaFold
            elif connector_id == "alphafold":
                resp = await client.get(f"{base_url}/prediction/{query}", timeout=30.0)
                if resp.status_code == 200:
                    data = resp.json()
                    data = data[0] if isinstance(data, list) and data else data
                    return {"results": [{"pdb_url": data.get("pdbUrl", ""), "cif_url": data.get("cifUrl", ""), "pae_url": data.get("paeImageUrl", ""), "gene": data.get("gene", "")}]}
                return {"results": []}
            
            # PDB
            elif connector_id == "pdb":
                resp = await client.get(f"{base_url}/search", params={"query": f"text:{query}", "return_all": False}, timeout=30.0)
                data = resp.json()
                return {"results": [{"id": r.get("identifier", ""), "title": r.get("struct", {}).get("title", "")} for r in data.get("result_set", [])[:10]]}
            
            # Ensembl
            elif connector_id == "ensembl":
                resp = await client.get(f"{base_url}/lookup/symbol/homo_sapiens/{query}", params={"expand": 1}, timeout=30.0)
                if resp.status_code == 200:
                    data = resp.json()
                    return {"results": [{"id": data.get("id", ""), "display_name": data.get("display_name", ""), "biotype": data.get("biotype", ""), "description": data.get("description", "")}]}
                return {"results": []}
            
            # KEGG
            elif connector_id == "kegg":
                resp = await client.get(f"{base_url}/find/genes/{query}", timeout=30.0)
                lines = resp.text.strip().split("\n")
                results = [{"id": l.split("\t")[0], "name": l.split("\t")[1]} for l in lines[:10] if "\t" in l]
                return {"results": results}
            
            # Reactome
            elif connector_id == "reactome":
                resp = await client.get(f"{base_url}/search/query", params={"query": query, "types": "Pathway", "cluster": True}, timeout=30.0)
                data = resp.json()
                return {"results": [{"id": r.get("stId", ""), "name": r.get("name", ""), "species": r.get("species", "")} for r in data.get("results", [])[:10]]}
            
            # Gene Ontology
            elif connector_id == "go":
                resp = await client.get(f"{base_url}/search/entity/autocomplete/{query}", timeout=30.0)
                data = resp.json()
                return {"results": [{"id": r.get("id", ""), "label": r.get("label", ""), "category": r.get("category", "")} for r in data.get("docs", [])[:10]]}
            
            # STRING
            elif connector_id == "string":
                resp = await client.get(f"{base_url}/json/interaction_partners", params={"identifiers": query, "limit": 10}, timeout=30.0)
                data = resp.json()
                return {"results": [{"partner": r.get("preferredName_B", ""), "score": r.get("score", 0)} for r in data[:10]]}
            
            # OpenAlex
            elif connector_id == "openalex":
                resp = await client.get(f"{base_url}/works", params={"search": query, "per_page": 10}, timeout=30.0)
                data = resp.json()
                return {"results": [{"id": w.get("id", ""), "title": w.get("title", ""), "cited_by": w.get("cited_by_count", 0)} for w in data.get("results", [])[:10]]}
            
            # Semantic Scholar
            elif connector_id == "semantic-scholar":
                resp = await client.get(f"{base_url}/paper/search", params={"query": query, "limit": 10}, timeout=30.0)
                data = resp.json()
                return {"results": [{"paperId": p.get("paperId", ""), "title": p.get("title", ""), "citationCount": p.get("citationCount", 0)} for p in data.get("data", [])[:10]]}
            
            # Crossref
            elif connector_id == "crossref":
                resp = await client.get(f"{base_url}/works", params={"query": query, "rows": 10}, timeout=30.0)
                data = resp.json()
                return {"results": [{"doi": item.get("DOI", ""), "title": item.get("title", [""])[0] if item.get("title") else "", "citations": item.get("is-referenced-by-count", 0)} for item in data.get("message", {}).get("items", [])[:10]]}
            
            # NCBI Gene
            elif connector_id == "ncbi-gene":
                resp = await client.get(f"{base_url}/esearch.fcgi", params={"db": "gene", "term": query, "retmax": 5, "retmode": "json"}, timeout=30.0)
                data = resp.json()
                ids = data.get("esearchresult", {}).get("idlist", [])
                if ids:
                    detail = await client.get(f"{base_url}/esummary.fcgi", params={"db": "gene", "id": ",".join(ids), "retmode": "json"}, timeout=30.0)
                    genes = detail.json().get("result", {})
                    return {"results": [{"gene_id": k, "name": v.get("name", ""), "description": v.get("description", "")} for k, v in genes.items() if isinstance(v, dict)]}
                return {"results": []}
            
            # GWAS Catalog
            elif connector_id == "gwas":
                resp = await client.get(f"{base_url}/singleNucleotidePolymorphisms/search", params={"query": query, "size": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("_embedded", {}).get("singleNucleotidePolymorphisms", [])[:10]}
                return {"results": []}
            
            # GTEx
            elif connector_id == "gtex":
                resp = await client.get(f"{base_url}/expression/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}
            
            # ENCODE
            elif connector_id == "encode":
                resp = await client.get(f"{base_url}/search/", params={"searchTerm": query, "type": "Experiment", "limit": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("@graph", [])[:10]}
                return {"results": []}
            
            # gnomAD
            elif connector_id == "gnomad":
                resp = await client.post("https://gnomad.broadinstitute.org/api", json={"query": f'{{ gene(gene_symbol: {__import__("json").dumps(query)}) {{ gene_id full_gene_name variants {{ rsid alt_ac }} }} }}'}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("data", {}).get("gene", {})}
                return {"results": []}
            
            # ClinVar
            elif connector_id == "clinvar":
                resp = await client.get(f"{base_url}/esearch.fcgi", params={"db": "clinvar", "term": query, "retmax": 10, "retmode": "json"}, timeout=30.0)
                data = resp.json()
                ids = data.get("esearchresult", {}).get("idlist", [])
                if ids:
                    detail = await client.get(f"{base_url}/esummary.fcgi", params={"db": "clinvar", "id": ",".join(ids), "retmode": "json"}, timeout=30.0)
                    return {"results": list(detail.json().get("result", {}).values())[:10]}
                return {"results": []}
            
            # dbSNP
            elif connector_id == "dbsnp":
                resp = await client.get(f"{base_url}/esearch.fcgi", params={"db": "snp", "term": query, "retmax": 10, "retmode": "json"}, timeout=30.0)
                data = resp.json()
                return {"results": data.get("esearchresult", {}).get("idlist", [])}
            
            # PubChem
            elif connector_id == "pubchem":
                resp = await client.get(f"{base_url}/compound/name/{query}/JSON", timeout=30.0)
                if resp.status_code == 200:
                    data = resp.json()
                    compound = data.get("PC_Compounds", [{}])[0]
                    return {"results": [{"cid": compound.get("id", {}).get("id", "")}]}
                return {"results": []}
            
            # ChEBI
            elif connector_id == "chebi":
                resp = await client.get(f"{base_url}/rest/search/{query}", params={"maxResults": 10, "responseType": "json"}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("list", [])[:10]}
                return {"results": []}
            
            # InterPro
            elif connector_id == "interpro":
                resp = await client.get(f"{base_url}/entry/interpro/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": [resp.json()]}
                return {"results": []}
            
            # Protein Atlas
            elif connector_id == "protein-atlas":
                resp = await client.get(f"https://www.proteinatlas.org/{query}.json", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": [resp.json()]}
                return {"results": []}
            
            # MyGene
            elif connector_id == "mygene":
                resp = await client.get(f"{base_url}/query", params={"q": query, "species": "human", "fields": "name,symbol,summary", "size": 10}, timeout=30.0)
                data = resp.json()
                return {"results": data.get("hits", [])[:10]}
            
            # JASPAR
            elif connector_id == "jaspar":
                resp = await client.get(f"{base_url}/v1/matrix/search/", params={"q": query}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("results", [])[:10]}
                return {"results": []}
            
            # Open Targets
            elif connector_id == "open-targets":
                resp = await client.post(base_url, json={"query": f'{{ target(ensemblId: {__import__("json").dumps(query)}) {{ id approvedSymbol associatedDiseases {{ rows {{ disease {{ name }} score }} }} }} }}'}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("data", {})}
                return {"results": []}
            
            # FDA
            elif connector_id == "fda":
                resp = await client.get(f"{base_url}/drugs.json", params={"search": f"openfda.brand_name:{query}", "limit": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("results", [])[:10]}
                return {"results": []}
            
            # Cancer Models (cBioPortal)
            elif connector_id == "cancer-models":
                resp = await client.get(f"{base_url}/studies/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": [resp.json()]}
                return {"results": []}
            
            # COSMIC
            elif connector_id == "cosmic":
                return {"results": [{"info": "COSMIC requires API key - visit cancer.sanger.ac.uk/cosmic"}]}
            
            # ClinGen
            elif connector_id == "clingen":
                resp = await client.get(f"https://search.clinicalgenome.org/kb/api/gene-validity", params={"query": query}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}
            
            # CIViC
            elif connector_id == "civic":
                resp = await client.get(f"{base_url}/variants", params={"search": query, "per_page": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("variants", [])[:10]}
                return {"results": []}
            
            # ZINC
            elif connector_id == "zinc":
                resp = await client.get(f"{base_url}/substances/search/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}
            
            # Grants.gov
            elif connector_id == "grants-gov":
                resp = await client.get(base_url, params={"keyword": query, "oppStatus": "forecasted,posted", "rows": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("oppHits", [])[:10]}
                return {"results": []}

            # arXiv
            elif connector_id == "arxiv":
                resp = await client.get(base_url, params={"search_query": f"all:{query}", "start": 0, "max_results": 10}, timeout=30.0)
                import xml.etree.ElementTree as ET
                root = ET.fromstring(resp.text)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                results = []
                for entry in root.findall("atom:entry", ns):
                    results.append({
                        "id": entry.find("atom:id", ns).text if entry.find("atom:id", ns) is not None else "",
                        "title": entry.find("atom:title", ns).text.strip() if entry.find("atom:title", ns) is not None else "",
                        "authors": [a.find("atom:name", ns).text for a in entry.findall("atom:author", ns) if a.find("atom:name", ns) is not None],
                        "summary": entry.find("atom:summary", ns).text[:200] if entry.find("atom:summary", ns) is not None else ""
                    })
                return {"results": results[:10]}

            # Ensembl BioMart
            elif connector_id == "ensembl-biomart":
                resp = await client.get("https://www.ensembl.org/biomart/martservice", params={
                    "type": "search", "query": query, "requestid": "0"
                }, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}

            # eQTL Catalogue
            elif connector_id == "eqtl-catalogue":
                resp = await client.get(f"{base_url}/studies", params={"search": query, "size": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("studies", [])[:10]}
                return {"results": []}

            # FinnGen
            elif connector_id == "finngen":
                resp = await client.get(f"{base_url}/phenotype", params={"phenotype": query}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}

            # UCSC Genome Browser
            elif connector_id == "ucsc":
                resp = await client.get(base_url, params={"cmd": "list", "hub": query}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}

            # Rfam
            elif connector_id == "rfam":
                resp = await client.get(f"{base_url}/search", params={"output": "json", "query": query, "start": 0, "size": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("results", [])[:10]}
                return {"results": []}

            # Pfam (via InterPro)
            elif connector_id == "pfam":
                resp = await client.get(f"https://www.ebi.ac.uk/interpro/api/entry/pfam/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": [resp.json()]}
                return {"results": []}

            # Foldseek
            elif connector_id == "foldseek":
                resp = await client.post(f"{base_url}/search", json={"sequence": query}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("results", [])[:10]}
                return {"results": []}

            # EMDB
            elif connector_id == "emdb":
                resp = await client.get(f"{base_url}/search", params={"query": query, "size": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("data", [])[:10]}
                return {"results": []}

            # Complex Portal
            elif connector_id == "complex-portal":
                resp = await client.get(f"{base_url}/search", params={"query": query, "page": 1, "pageSize": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("content", [])[:10]}
                return {"results": []}

            # IntAct
            elif connector_id == "intact":
                resp = await client.get(f"{base_url}/search", params={"query": query, "first": 0, "pageSize": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("content", [])[:10]}
                return {"results": []}

            # PRIDE
            elif connector_id == "pride":
                resp = await client.get(f"{base_url}/projects/search", params={"query": query, "pageSize": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("list", [])[:10]}
                return {"results": []}

            # UniBind
            elif connector_id == "unibind":
                resp = await client.get(f"{base_url}/tfbs/{query}", timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}

            # BindingDB
            elif connector_id == "bindingdb":
                resp = await client.get(f"{base_url}/search", params={"keyword": query, "count": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json()[:10] if isinstance(resp.json(), list) else []}
                return {"results": []}

            # Rhea
            elif connector_id == "rhea":
                resp = await client.get(f"{base_url}/reactions", params={"name": query, "limit": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("data", [])[:10]}
                return {"results": []}

            # Antibody Registry
            elif connector_id == "antibody-registry":
                resp = await client.get(f"{base_url}/antibodies", params={"q": query, "page_size": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("results", [])[:10]}
                return {"results": []}

            # ArrayExpress
            elif connector_id == "arrayexpress":
                resp = await client.get(f"{base_url}/studies", params={"keywords": query, "pageSize": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("studies", [])[:10]}
                return {"results": []}

            # GEO
            elif connector_id == "geo":
                resp = await client.get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params={
                    "db": "gds", "term": query, "retmax": 10, "retmode": "json"
                }, timeout=30.0)
                data = resp.json()
                ids = data.get("esearchresult", {}).get("idlist", [])
                if ids:
                    detail = await client.get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", params={
                        "db": "gds", "id": ",".join(ids), "retmode": "json"
                    }, timeout=30.0)
                    return {"results": list(detail.json().get("result", {}).values())[:10]}
                return {"results": []}

            # MGnify
            elif connector_id == "mgnify":
                resp = await client.get(f"{base_url}/v2/studies", params={"search": query, "pageSize": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("metadata", {}).get("studies", [])[:10]}
                return {"results": []}

            # CellGuide
            elif connector_id == "cellguide":
                resp = await client.get(f"{base_url}/cell-types", params={"search": query, "limit": 10}, timeout=30.0)
                if resp.status_code == 200:
                    return {"results": resp.json().get("data", [])[:10]}
                return {"results": []}

            else:
                return {"error": f"Connector {connector_id} search not implemented"}
    
    except Exception as e:
        return {"error": str(e)}
