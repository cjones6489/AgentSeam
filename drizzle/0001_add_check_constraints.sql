ALTER TABLE actions
  ADD CONSTRAINT actions_status_check
  CHECK (status IN ('pending','approved','rejected','expired','executing','executed','failed'));

ALTER TABLE actions
  ADD CONSTRAINT actions_action_type_check
  CHECK (action_type IN ('send_email','http_post','http_delete','shell_command','db_write','file_write','file_delete'));
