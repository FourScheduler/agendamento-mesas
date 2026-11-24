ALTER TABLE usuarios ADD COLUMN microsoft_tenant_id VARCHAR(36);
ALTER TABLE usuarios ADD COLUMN microsoft_object_id VARCHAR(36);

ALTER TABLE usuarios ADD CONSTRAINT uk_usuarios_identidade_microsoft
    UNIQUE (microsoft_tenant_id, microsoft_object_id);
