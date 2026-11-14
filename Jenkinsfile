pipeline {
  agent any

  environment {
    COMPOSE_DIR = '/opt/prila'
    SERVICE = 'admin'
    IMAGE = 'prila-admin'
  }

  stages {
    stage('Pull') {
      steps {
        checkout scm
        sh 'git fetch origin main && git checkout main && git pull --ff-only origin main'
      }
    }

    stage('Build') {
      steps {
        script {
          sh """
            docker tag ${IMAGE}:latest ${IMAGE}:previous || true
            docker build \\
              --build-arg VITE_API_BASE_URL=https://api.prila.in/api/v1 \\
              -t ${IMAGE}:latest .
          """
        }
      }
    }

    stage('Deploy') {
      steps {
        dir("${COMPOSE_DIR}") {
          sh "docker compose up -d --no-deps --force-recreate ${SERVICE}"
        }
      }
    }

    stage('Health') {
      steps {
        script {
          def ok = false
          for (int i = 0; i < 30; i++) {
            def code = sh(
              script: 'curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/ || true',
              returnStdout: true
            ).trim()
            if (code == '200') {
              ok = true
              break
            }
            sleep 2
          }
          if (!ok) {
            error('Admin health check failed')
          }
        }
      }
    }
  }

  post {
    failure {
      script {
        echo 'Health failed — rolling back to previous image'
        sh """
          if docker image inspect ${IMAGE}:previous >/dev/null 2>&1; then
            docker tag ${IMAGE}:previous ${IMAGE}:latest
            cd ${COMPOSE_DIR} && docker compose up -d --no-deps --force-recreate ${SERVICE}
          else
            echo 'No previous image available for rollback'
          fi
        """
      }
    }
  }
}
