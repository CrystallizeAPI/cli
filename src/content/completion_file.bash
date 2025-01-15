_crystallize_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local cmd="${COMP_WORDS[1]}"
  local subcmd="${COMP_WORDS[2]}"    
  local subsubcmd="${COMP_WORDS[3]}"
  
  local commands="help install-boilerplate login whoami run-mass-operation"
  local program_options="--version"
  local default_options="--help"

  COMPREPLY=()

  case "${cmd}" in
    login)
        local options="${default_options}"
        COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
        return 0
        ;;
    install-boilerplate)
      local options="${default_options} --bootstrap-tenant"
      COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
      return 0
      ;;
    run-mass-operation)
      local options="${default_options} --token_id= --token_secret= --legacy-spec" 
      COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
      return 0
      ;;
  esac

  if [[ "${COMP_CWORD}" -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${commands} ${program_options} ${default_options}" -- "${cur}"))
  fi
}

complete -F _crystallize_completions crystallize
