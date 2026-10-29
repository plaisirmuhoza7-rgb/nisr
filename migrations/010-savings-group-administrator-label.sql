-- Descriptive text entered at group setup; this label grants no authority.
ALTER TABLE savings_group_policies
 ADD COLUMN administrator_label text NOT NULL DEFAULT ''
 CHECK (char_length(administrator_label)<=120);
