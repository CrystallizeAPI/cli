_crystallize_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local cmd="${COMP_WORDS[1]}"
  local subcmd="${COMP_WORDS[2]}"    
  local subsubcmd="${COMP_WORDS[3]}"
  
  local commands="help changelog boilerplate tenant login whoami mass-operation"
  local program_options="--version"
  local default_options="--help"
  local i_login_options="--no-interactive --token_id= --token_secret="

  COMPREPLY=()

  if [[ "${COMP_CWORD}" -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${commands} ${program_options} ${default_options}" -- "${cur}"))
    return 0
  fi

  case "${cmd}" in
    login|whoami)
        local options="${default_options}"
        COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
        return 0
        ;;
    boilerplate)
        if [[ "${COMP_CWORD}" -eq 2 ]]; then
            local options="install ${default_options}"
            COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
            return 0
        fi
        case "${subcmd}" in
            install)
                local options="--bootstrap-tenant ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
        esac
      ;;
    mass-operation)
        if [[ "${COMP_CWORD}" -eq 2 ]]; then
                local options="run dump-content-model execute-mutations ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
        fi
        case "${subcmd}" in
            run)
                local options="${i_login_options} --legacy-spec ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
            dump-content-model)
                local options="${i_login_options} --force ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
            execute-mutations)
                local options="${i_login_options} ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
        esac
      ;;
    tenant)
        if [[ "${COMP_CWORD}" -eq 2 ]]; then
                local options="create invite ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
        fi
        case "${subcmd}" in
            create)
                local options="${i_login_options} --fail-if-not-available ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
            invite)
                local options="${i_login_options} --number= --role= --expiry= ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
            ;;
        esac
    ;;
    token)
        if [[ "${COMP_CWORD}" -eq 2 ]]; then
                local options="pim static shop ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
        fi
        case "${subcmd}" in
            shop)
                local options="${i_login_options} --expiry= --scopes= ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
            pim)
                local options="${i_login_options} ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;
            static)
                local options="${i_login_options} ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;                
        esac
    ;;
    image)
        if [[ "${COMP_CWORD}" -eq 2 ]]; then
                local options="upload ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
        fi
        case "${subcmd}" in
            upload)
                local options="${i_login_options} --force ${default_options}"
                COMPREPLY=($(compgen -W "${options}" -- "${cur}"))
                return 0
                ;;         
        esac
    ;;
  esac
}

complete -F _crystallize_completions crystallize
